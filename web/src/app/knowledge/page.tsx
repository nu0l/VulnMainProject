'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, Table, Tag, Typography, Button, Tabs } from '@douyinfe/semi-ui';
import { vulnApi, VULN_SEVERITIES, knowledgeApi, authUtils, type Vulnerability } from '@/lib/api';
import VulnDetailModal from '@/components/VulnDetailModal';

const { Title, Text } = Typography;

interface AlertItem {
  title: string;
  severity: string;
  source: string;
  publish_at: string;
  link: string;
  summary: string;
}

export default function KnowledgePage() {
  const [activeKey, setActiveKey] = useState('internal');

  const [vulnLoading, setVulnLoading] = useState(false);
  const [vulnRows, setVulnRows] = useState<Vulnerability[]>([]);
  const [vulnPagination, setVulnPagination] = useState({ currentPage: 1, pageSize: 20, total: 0 });

  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewVuln, setPreviewVuln] = useState<Vulnerability | null>(null);
  const currentUser = authUtils.getCurrentUser();

  const [alertLoading, setAlertLoading] = useState(false);
  const [alertRows, setAlertRows] = useState<AlertItem[]>([]);
  const [alertPagination, setAlertPagination] = useState({ currentPage: 1, pageSize: 10, total: 0 });

  const loadInternalVulns = async (page = 1, pageSize = vulnPagination.pageSize) => {
    setVulnLoading(true);
    try {
      const params: Record<string, unknown> = { page, page_size: pageSize };
      if (currentUser?.role_id === 3 && currentUser?.id) {
        params.assignee_id = currentUser.id;
      }
      if (currentUser?.role_id === 2 && currentUser?.id) {
        params.reporter_id = currentUser.id;
      }
      const res = await vulnApi.getVulnList(params as any);
      const data = res.data;
      const list = data?.vulnerabilities || data?.vulns || [];
      setVulnRows(list);
      setVulnPagination({
        currentPage: data?.current_page || page,
        pageSize: data?.page_size || pageSize,
        total: data?.total || 0,
      });
    } finally {
      setVulnLoading(false);
    }
  };

  const loadAlerts = async (page = 1, pageSize = alertPagination.pageSize) => {
    setAlertLoading(true);
    try {
      const res = await knowledgeApi.alerts({ page, page_size: pageSize });
      const data = res.data;
      setAlertRows(data?.items || []);
      setAlertPagination({
        currentPage: data?.page || page,
        pageSize: data?.page_size || pageSize,
        total: data?.total || 0,
      });
    } finally {
      setAlertLoading(false);
    }
  };

  useEffect(() => {
    loadInternalVulns(1, 20);
    loadAlerts(1, 10);
  }, []);


  const handlePreviewVuln = async (id: number) => {
    try {
      const res = await vulnApi.getVuln(id);
      if (res.code === 200 && res.data) {
        setPreviewVuln(res.data);
        setPreviewVisible(true);
      }
    } catch (error) {
      // ignore
    }
  };

  const severityTag = (severity: string) => {
    const item = VULN_SEVERITIES.find((s) => s.value === severity);
    return <Tag color={item?.color || 'grey'}>{item?.label || severity}</Tag>;
  };

  const internalColumns = useMemo(() => [
    { title: '漏洞名称', dataIndex: 'title', key: 'title', width: 260 },
    { title: '漏洞等级', dataIndex: 'severity', key: 'severity', width: 120, render: severityTag },
    { title: '所属项目', key: 'project', render: (_: unknown, r: Vulnerability) => r.project?.name || '-' },
    { title: '提交人', key: 'reporter', render: (_: unknown, r: Vulnerability) => r.reporter?.real_name || r.reporter?.username || '-' },
    {
      title: '提交时间', dataIndex: 'submitted_at', key: 'submitted_at', width: 180,
      render: (v: string) => v ? new Date(v).toLocaleString() : '-'
    },
    {
      title: '操作', key: 'action', width: 120,
      render: (_: unknown, r: Vulnerability) => <a onClick={() => handlePreviewVuln(r.id)}>预览</a>
    },
  ], []);

  const alertColumns = useMemo(() => [
    { title: '通告标题', dataIndex: 'title', key: 'title', width: 300 },
    { title: '风险等级', dataIndex: 'severity', key: 'severity', width: 120, render: severityTag },
    { title: '来源', dataIndex: 'source', key: 'source', width: 160 },
    {
      title: '发布时间', dataIndex: 'publish_at', key: 'publish_at', width: 180,
      render: (v: string) => v ? new Date(v).toLocaleString() : '-'
    },
    {
      title: '摘要', dataIndex: 'summary', key: 'summary',
      render: (v: string) => <Text ellipsis={{ showTooltip: true }}>{v || '-'}</Text>
    },
    {
      title: '链接', dataIndex: 'link', key: 'link', width: 120,
      render: (v: string) => v ? <a href={v} target="_blank" rel="noreferrer">查看原文</a> : '-'
    },
  ], []);

  return (
    <div style={{ padding: 24 }}>
      <Card title={<Title heading={4} style={{ margin: 0 }}>知识库</Title>}>
        <Tabs activeKey={activeKey} onChange={setActiveKey} type="card">
          <Tabs.TabPane itemKey="internal" tab="系统漏洞">
            <Text type="secondary">该分页展示系统内所有漏洞报告。</Text>
            <div style={{ marginTop: 16 }}>
              <Table
                columns={internalColumns}
                dataSource={vulnRows}
                loading={vulnLoading}
                pagination={{
                  currentPage: vulnPagination.currentPage,
                  pageSize: vulnPagination.pageSize,
                  total: vulnPagination.total,
                  showSizeChanger: true,
                  onPageChange: (page) => loadInternalVulns(page, vulnPagination.pageSize),
                  onPageSizeChange: (size) => loadInternalVulns(1, size),
                }}
              />
            </div>
          </Tabs.TabPane>

          <Tabs.TabPane itemKey="alerts" tab="漏洞预警">
            <Text type="secondary">该分页展示系统设置中配置的漏洞预警订阅信息。</Text>
            <div style={{ marginTop: 12 }}>
              <Button onClick={() => loadAlerts(alertPagination.currentPage, alertPagination.pageSize)}>刷新预警</Button>
            </div>
            <div style={{ marginTop: 16 }}>
              <Table
                columns={alertColumns}
                dataSource={alertRows}
                loading={alertLoading}
                pagination={{
                  currentPage: alertPagination.currentPage,
                  pageSize: alertPagination.pageSize,
                  total: alertPagination.total,
                  showSizeChanger: true,
                  onPageChange: (page) => loadAlerts(page, alertPagination.pageSize),
                  onPageSizeChange: (size) => loadAlerts(1, size),
                }}
              />
            </div>
          </Tabs.TabPane>
        </Tabs>
      </Card>

      <VulnDetailModal visible={previewVisible} onCancel={() => setPreviewVisible(false)} vuln={previewVuln} />

    </div>
  );
}
