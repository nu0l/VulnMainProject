'use client';

import { useEffect, useState } from 'react';
import { Card, Table, Tag, Typography, Button } from '@douyinfe/semi-ui';
import { vulnApi, VULN_SEVERITIES } from '@/lib/api';

const { Title, Text } = Typography;

export default function KnowledgePage() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await vulnApi.getVulnList({ page: 1, page_size: 200 });
      const vulns = res.data?.vulnerabilities || res.data?.vulns || [];
      setRows(vulns);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const columns = [
    { title: '漏洞名称', dataIndex: 'title', key: 'title', width: 260 },
    {
      title: '漏洞等级', dataIndex: 'severity', key: 'severity', width: 120,
      render: (severity: string) => {
        const item = VULN_SEVERITIES.find((s) => s.value === severity);
        return <Tag color={item?.color || 'grey'}>{item?.label || severity}</Tag>;
      }
    },
    { title: '所属项目', key: 'project', render: (_: any, r: any) => r.project?.name || '-' },
    { title: '提交人', key: 'reporter', render: (_: any, r: any) => r.reporter?.real_name || r.reporter?.username || '-' },
    {
      title: '提交时间', dataIndex: 'submitted_at', key: 'submitted_at', width: 180,
      render: (v: string) => v ? new Date(v).toLocaleString() : '-'
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={<Title heading={4} style={{ margin: 0 }}>知识库（漏洞库）</Title>}
        headerExtraContent={<Button onClick={load}>刷新</Button>}
      >
        <Text type="secondary">汇总系统内漏洞报告，支持按详情查看漏洞描述、复现步骤、请求数据包和修复建议。</Text>
        <div style={{ marginTop: 16 }}>
          <Table columns={columns} dataSource={rows} loading={loading} pagination={{ pageSize: 20 }} />
        </div>
      </Card>
    </div>
  );
}
