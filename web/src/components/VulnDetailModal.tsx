'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { Vulnerability, VulnTimeline } from '@/lib/api';
import { vulnApi } from '@/lib/api';
import { Modal, Button, Tag, Typography, Spin } from '@douyinfe/semi-ui';
import MarkdownViewer from './MarkdownViewer';

const { Title, Text } = Typography;

interface VulnDetailModalProps {
  visible: boolean;
  onCancel: () => void;
  vuln: Vulnerability | null;
}

const timelineColorMap: Record<string, string> = {
  created: '#1890ff',
  assigned: '#fa8c16',
  fixing: '#52c41a',
  fixed: '#13c2c2',
  retesting: '#722ed1',
  completed: '#52c41a',
  ignored: '#8c8c8c',
  rejected: '#f5222d',
};

const timelineActionLabelMap: Record<string, string> = {
  created: '创建',
  assigned: '分配',
  fixing: '修复中',
  fixed: '已修复',
  retesting: '复测中',
  completed: '已完成',
  ignored: '已忽略',
  rejected: '驳回',
};

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
      return;
    }

    const loadTimeline = async () => {
      setTimelineLoading(true);
      try {
        const res = await vulnApi.getVulnTimeline(vuln.id);
        if (res.code === 200) {
          setTimeline(res.data || []);
        } else {
          setTimeline([]);
        }
      } catch {
        setTimeline([]);
      } finally {
        setTimelineLoading(false);
      }
    };

    loadTimeline();
  }, [visible, vuln?.id]);

  const fixDeadlineText = useMemo(() => {
    if (!vuln?.fix_deadline) return '-';
    return new Date(vuln.fix_deadline).toLocaleDateString('zh-CN');
  }, [vuln?.fix_deadline]);

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
                <div style={{ marginTop: '6px' }}><Tag color="red" size="large">{vuln.severity || '-'}</Tag></div>
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
                <div style={{ marginTop: '6px' }}><Tag color="blue" size="large">{vuln.status || '-'}</Tag></div>
              </div>
              <div style={{ padding: '12px', backgroundColor: 'var(--semi-color-fill-0)', borderRadius: '6px' }}>
                <Text type="secondary" size="small">修复期限：</Text>
                <div style={{ marginTop: '4px' }}><Text strong>{fixDeadlineText}</Text></div>
              </div>
            </div>
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

          <div>
            <Title heading={5} style={{ marginBottom: '16px', color: 'var(--semi-color-primary)' }}>处理时间线</Title>
            <div style={{ padding: '12px', border: '1px solid var(--semi-color-border)', borderRadius: '6px', minHeight: '120px' }}>
              {timelineLoading ? (
                <Spin spinning />
              ) : timeline.length === 0 ? (
                <Text type="tertiary">暂无时间线</Text>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
                  {timeline.map((item, index) => {
                    const color = timelineColorMap[item.action] || '#1890ff';
                    const label = timelineActionLabelMap[item.action] || item.action;
                    return (
                      <React.Fragment key={item.id}>
                        <div style={{ minWidth: '100px', padding: '8px', borderRadius: '6px', border: `2px solid ${color}`, textAlign: 'center' }}>
                          <Text strong style={{ color }}>{label}</Text>
                          <div><Text size="small" type="tertiary">{new Date(item.created_at).toLocaleDateString('zh-CN')}</Text></div>
                          <div><Text size="small" type="tertiary">{new Date(item.created_at).toLocaleTimeString('zh-CN')}</Text></div>
                          <div><Text size="small" type="secondary">{item.user?.real_name || item.user?.username || '-'}</Text></div>
                        </div>
                        {index < timeline.length - 1 && <div style={{ width: '16px', height: '2px', background: '#d9d9d9', marginTop: '32px' }} />}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
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
