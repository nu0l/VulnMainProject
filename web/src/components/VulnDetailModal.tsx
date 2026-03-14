'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { Vulnerability, VulnTimeline } from '@/lib/api';
import { vulnApi, VULN_SEVERITIES, VULN_STATUSES } from '@/lib/api';
import { Modal, Button, Tag, Typography } from '@douyinfe/semi-ui';
import MarkdownViewer from './MarkdownViewer';
import VulnTimelineViewer from './VulnTimelineViewer';

const { Title, Text } = Typography;

interface VulnDetailModalProps {
  visible: boolean;
  onCancel: () => void;
  vuln: Vulnerability | null;
  timeline?: VulnTimeline[];
  timelineLoading?: boolean;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'pending':
      return 'orange';
    case 'confirmed':
      return 'red';
    case 'fixing':
      return 'blue';
    case 'fixed':
      return 'green';
    case 'retesting':
      return 'purple';
    case 'completed':
      return 'green';
    case 'ignored':
      return 'grey';
    case 'rejected':
      return 'pink';
    default:
      return 'grey';
  }
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'red';
    case 'high':
      return 'orange';
    case 'medium':
      return 'yellow';
    case 'low':
      return 'blue';
    default:
      return 'grey';
  }
}

export default function VulnDetailModal({
  visible,
  onCancel,
  vuln,
  timeline,
  timelineLoading,
}: VulnDetailModalProps) {
  const [innerTimelineLoading, setInnerTimelineLoading] = useState(false);
  const [innerTimeline, setInnerTimeline] = useState<VulnTimeline[]>([]);

  useEffect(() => {
    document.body.style.overflow = visible ? 'hidden' : 'auto';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [visible]);

  useEffect(() => {
    if (timeline !== undefined || timelineLoading !== undefined) return;
    if (!visible || !vuln?.id) {
      setInnerTimeline([]);
      return;
    }

    let cancelled = false;
    const loadTimeline = async () => {
      setInnerTimelineLoading(true);
      try {
        const res = await vulnApi.getVulnTimeline(vuln.id);
        if (!cancelled && res.code === 200) {
          setInnerTimeline(res.data || []);
        }
      } catch {
        if (!cancelled) setInnerTimeline([]);
      } finally {
        if (!cancelled) setInnerTimelineLoading(false);
      }
    };

    loadTimeline();
    return () => {
      cancelled = true;
    };
  }, [visible, vuln?.id, timeline, timelineLoading]);

  const currentTimeline = timeline ?? innerTimeline;
  const currentTimelineLoading = timelineLoading ?? innerTimelineLoading;

  const deadlineMeta = useMemo(() => {
    if (!vuln?.fix_deadline) return null;

    const deadlineDate = new Date(vuln.fix_deadline);
    const now = new Date();
    const daysDiff = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const isOverdue = deadlineDate < now;

    const textColor = isOverdue ? '#ff4d4f' : daysDiff <= 3 ? '#fa8c16' : '#1890ff';
    const bgColor = isOverdue ? 'rgba(255, 77, 79, 0.1)' : daysDiff <= 3 ? 'rgba(250, 140, 22, 0.1)' : 'rgba(24, 144, 255, 0.1)';

    let hint = `剩余${Math.max(daysDiff, 0)}天`;
    if (vuln.status === 'completed') {
      hint = '已完成';
    } else if (isOverdue) {
      hint = `已超期${Math.abs(daysDiff)}天`;
    }

    return {
      dateText: deadlineDate.toLocaleDateString('zh-CN'),
      textColor,
      bgColor,
      hint,
    };
  }, [vuln?.fix_deadline, vuln?.status]);

  if (!vuln) return null;

  return (
    <Modal
      title="漏洞详情"
      visible={visible}
      onCancel={onCancel}
      footer={<Button onClick={onCancel}>关闭</Button>}
      width={1400}
      centered
      maskClosable
      bodyStyle={{
        padding: '24px',
        height: '800px',
        overflow: 'visible',
      }}
      style={{
        top: 0,
        paddingBottom: 0,
      }}
    >
      <div style={{ display: 'flex', gap: '32px', minHeight: '800px', lineHeight: '1.6' }}>
        <div style={{ flex: '0 0 500px', paddingRight: '32px', borderRight: '2px dashed var(--semi-color-border)', overflowY: 'auto', maxHeight: '800px' }}>
          <div style={{ marginBottom: '24px' }}>
            <Title heading={5} style={{ marginBottom: '16px', color: 'var(--semi-color-primary)' }}>基础信息</Title>

            <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
              <Text type="secondary" size="small">漏洞标题：</Text>
              <div style={{ marginTop: '4px' }}><Text strong style={{ fontSize: '16px' }}>{vuln.title}</Text></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                <Text type="secondary" size="small">漏洞类型：</Text>
                <div style={{ marginTop: '4px' }}><Text strong>{vuln.vuln_type || '-'}</Text></div>
              </div>
              <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                <Text type="secondary" size="small">严重程度：</Text>
                <div style={{ marginTop: '6px' }}>
                  <Tag color={getSeverityColor(vuln.severity)} size="large">
                    {VULN_SEVERITIES.find((s) => s.value === vuln.severity)?.label || vuln.severity}
                  </Tag>
                </div>
              </div>
              {vuln.cve_id && (
                <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                  <Text type="secondary" size="small">CVE编号：</Text>
                  <div style={{ marginTop: '4px' }}><Text strong>{vuln.cve_id}</Text></div>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                <Text type="secondary" size="small">当前状态：</Text>
                <div style={{ marginTop: '6px' }}>
                  <Tag color={getStatusColor(vuln.status)} size="large">
                    {VULN_STATUSES.find((s) => s.value === vuln.status)?.label || vuln.status}
                  </Tag>
                </div>
              </div>

              {deadlineMeta && (
                <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                  <Text type="secondary" size="small">修复期限：</Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                    <Text strong style={{ fontSize: '14px', fontWeight: '600', color: deadlineMeta.textColor, padding: '4px 12px', borderRadius: '4px', backgroundColor: deadlineMeta.bgColor }}>
                      {deadlineMeta.dateText}
                    </Text>
                    <Text type="secondary" size="small">{deadlineMeta.hint}</Text>
                  </div>
                </div>
              )}
            </div>

            {vuln.vuln_url && (
              <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                <Text type="secondary" size="small">漏洞地址：</Text>
                <div style={{ marginTop: '4px' }}><Text>{vuln.vuln_url}</Text></div>
              </div>
            )}

            {vuln.tags && (
              <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                <Text type="secondary" size="small">标签：</Text>
                <div style={{ marginTop: '4px' }}><Text>{vuln.tags}</Text></div>
              </div>
            )}
          </div>

          <div style={{ marginBottom: '24px' }}>
            <Title heading={5} style={{ marginBottom: '16px', color: 'var(--semi-color-primary)' }}>关联信息</Title>

            <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
              <Text type="secondary" size="small">所属项目：</Text>
              <div style={{ marginTop: '4px' }}><Text strong>{vuln.project?.name || '-'}</Text></div>
            </div>

            <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
              <Text type="secondary" size="small">关联资产：</Text>
              <div style={{ marginTop: '4px' }}><Text strong>{vuln.asset ? `${vuln.asset.name} (${vuln.asset.ip})` : '未知'}</Text></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                <Text type="secondary" size="small">提交人：</Text>
                <div style={{ marginTop: '4px' }}><Text strong>{vuln.reporter?.real_name || vuln.reporter?.username || '-'}</Text></div>
              </div>
              <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                <Text type="secondary" size="small">指派人：</Text>
                <div style={{ marginTop: '4px' }}><Text strong>{vuln.assignee?.real_name || '未指派'}</Text></div>
              </div>
              {vuln.fixer && (
                <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                  <Text type="secondary" size="small">修复人：</Text>
                  <div style={{ marginTop: '4px' }}><Text strong>{vuln.fixer.real_name}</Text></div>
                </div>
              )}
              {vuln.retester && (
                <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                  <Text type="secondary" size="small">复测人：</Text>
                  <div style={{ marginTop: '4px' }}><Text strong>{vuln.retester.real_name}</Text></div>
                </div>
              )}
            </div>
          </div>

          <VulnTimelineViewer timeline={currentTimeline} loading={currentTimelineLoading} maxWidth={468} showDragHint />
          <div style={{ height: '24px' }} />
        </div>

        <div style={{ flex: 1, paddingLeft: '32px', overflowY: 'auto', maxHeight: '800px' }}>
          {vuln.description && (
            <div style={{ marginBottom: '24px' }}>
              <Title heading={5} style={{ marginBottom: '16px', color: 'var(--semi-color-primary)' }}>漏洞详情</Title>
              <div style={{ padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #e9ecef' }}>
                <MarkdownViewer content={vuln.description} />
              </div>
            </div>
          )}

          {vuln.request_packet && (
            <div style={{ marginBottom: '24px' }}>
              <Title heading={5} style={{ marginBottom: '16px', color: 'var(--semi-color-primary)' }}>请求数据包</Title>
              <div style={{ padding: '16px', backgroundColor: '#0f172a', color: '#e2e8f0', borderRadius: '6px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>
                <Text style={{ color: '#e2e8f0' }}>{vuln.request_packet}</Text>
              </div>
              <div style={{ marginTop: '8px' }}>
                <Text type="secondary" size="small">提示：Cookie 或 Token 可能过期，但仍建议保留原始请求用于复现分析。</Text>
              </div>
            </div>
          )}

          {vuln.fix_suggestion && (
            <div style={{ marginBottom: '24px' }}>
              <Title heading={5} style={{ marginBottom: '16px', color: 'var(--semi-color-primary)' }}>修复建议</Title>
              <div style={{ padding: '16px', backgroundColor: '#f0f9ff', borderRadius: '6px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                <Text>{vuln.fix_suggestion}</Text>
              </div>
            </div>
          )}

          {vuln.ignore_reason && (
            <div style={{ marginBottom: '24px' }}>
              <Title heading={5} style={{ marginBottom: '16px', color: 'var(--semi-color-primary)' }}>忽略原因</Title>
              <div style={{ padding: '16px', backgroundColor: '#fef2f2', borderRadius: '6px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                <Text>{vuln.ignore_reason}</Text>
              </div>
            </div>
          )}

          {vuln.retest_result && (
            <div style={{ marginBottom: '24px' }}>
              <Title heading={5} style={{ marginBottom: '16px', color: 'var(--semi-color-primary)' }}>复测结果</Title>
              <div style={{ padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '6px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                <Text>{vuln.retest_result}</Text>
              </div>
            </div>
          )}

          <div style={{ height: '24px' }} />
        </div>
      </div>
    </Modal>
  );
}
