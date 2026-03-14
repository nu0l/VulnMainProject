'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { Vulnerability, VulnTimeline } from '@/lib/api';
import { vulnApi } from '@/lib/api';
import { Modal, Button, Tag, Typography } from '@douyinfe/semi-ui';
import MarkdownViewer from './MarkdownViewer';
import VulnTimelineViewer from './VulnTimelineViewer';

const { Title, Text } = Typography;

interface VulnDetailModalProps {
  visible: boolean;
  onCancel: () => void;
  vuln: Vulnerability | null;
}

const statusColorMap: Record<string, string> = {
  pending: 'orange',
  confirmed: 'red',
  fixing: 'blue',
  fixed: 'green',
  retesting: 'purple',
  completed: 'green',
  ignored: 'grey',
  rejected: 'pink',
};

const severityColorMap: Record<string, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'yellow',
  low: 'blue',
  info: 'grey',
};

function formatDate(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return date.toLocaleDateString('zh-CN');
}

function formatDeadlineRemaining(value?: string): string {
  if (!value) return '';
  const now = new Date();
  const deadline = new Date(value);
  if (Number.isNaN(deadline.getTime())) {
    return '';
  }

  const days = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days > 0) return `${days}天后`;
  if (days === 0) return '今天到期';
  return `已逾期${Math.abs(days)}天`;
}

export default function VulnDetailModal({ visible, onCancel, vuln }: VulnDetailModalProps) {
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timeline, setTimeline] = useState<VulnTimeline[]>([]);

  useEffect(() => {
    document.body.style.overflow = visible ? 'hidden' : 'auto';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || !vuln?.id) {
      setTimeline([]);
      return;
    }

    let cancelled = false;

    const loadTimeline = async () => {
      setTimelineLoading(true);
      try {
        const res = await vulnApi.getVulnTimeline(vuln.id);
        if (!cancelled && res.code === 200) {
          setTimeline(res.data || []);
        }
      } catch {
        if (!cancelled) {
          setTimeline([]);
        }
      } finally {
        if (!cancelled) {
          setTimelineLoading(false);
        }
      }
    };

    loadTimeline();

    return () => {
      cancelled = true;
    };
  }, [visible, vuln?.id]);

  const fixDeadlineText = useMemo(() => formatDate(vuln?.fix_deadline), [vuln?.fix_deadline]);
  const fixDeadlineRemaining = useMemo(() => formatDeadlineRemaining(vuln?.fix_deadline), [vuln?.fix_deadline]);

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
      bodyStyle={{ padding: '24px', height: '800px', overflow: 'visible' }}
      style={{ top: 0, paddingBottom: 0 }}
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
                <div style={{ marginTop: '6px' }}><Tag color={severityColorMap[vuln.severity] || 'grey'} size="large">{vuln.severity || '-'}</Tag></div>
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
                <div style={{ marginTop: '6px' }}><Tag color={statusColorMap[vuln.status] || 'grey'} size="large">{vuln.status || '-'}</Tag></div>
              </div>
              <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                <Text type="secondary" size="small">修复期限：</Text>
                <div style={{ marginTop: '4px' }}>
                  <Text strong>{fixDeadlineText}</Text>
                  {fixDeadlineRemaining && <Text type="secondary" size="small" style={{ marginLeft: '8px' }}>{fixDeadlineRemaining}</Text>}
                </div>
              </div>
            </div>
            {vuln.vuln_url && (
              <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                <Text type="secondary" size="small">漏洞地址：</Text>
                <div style={{ marginTop: '4px' }}><Text>{vuln.vuln_url}</Text></div>
              </div>
            )}
          </div>

          <div style={{ marginBottom: '24px' }}>
            <Title heading={5} style={{ marginBottom: '16px', color: 'var(--semi-color-primary)' }}>关联信息</Title>
            <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
              <Text type="secondary" size="small">所属项目：</Text>
              <div style={{ marginTop: '4px' }}><Text strong>{vuln.project?.name || '-'}</Text></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                <Text type="secondary" size="small">提交人：</Text>
                <div style={{ marginTop: '4px' }}><Text strong>{vuln.reporter?.real_name || vuln.reporter?.username || '-'}</Text></div>
              </div>
              <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                <Text type="secondary" size="small">指派人：</Text>
                <div style={{ marginTop: '4px' }}><Text strong>{vuln.assignee?.real_name || vuln.assignee?.username || '未指派'}</Text></div>
              </div>
            </div>
          </div>

          <VulnTimelineViewer
            timeline={timeline}
            loading={timelineLoading}
            maxWidth={468}
            showDragHint
          />
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

          {vuln.fix_suggestion && (
            <div style={{ marginBottom: '24px' }}>
              <Title heading={5} style={{ marginBottom: '16px', color: 'var(--semi-color-primary)' }}>修复建议</Title>
              <div style={{ padding: '16px', backgroundColor: '#f0f9ff', borderRadius: '6px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                <Text>{vuln.fix_suggestion}</Text>
              </div>
            </div>
          )}

          <div style={{ marginBottom: '24px' }}>
            <Title heading={5} style={{ marginBottom: '16px', color: 'var(--semi-color-primary)' }}>请求数据包</Title>
            <div style={{ padding: '16px', backgroundColor: '#fafafa', borderRadius: '6px', border: '1px solid #eee', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '240px', overflowY: 'auto' }}>
              <Text style={{ fontFamily: 'monospace' }}>{vuln.request_packet || '暂无数据包'}</Text>
            </div>
          </div>

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
        </div>
      </div>
    </Modal>
  );
}
