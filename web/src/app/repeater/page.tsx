'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Typography, TextArea, Select, Toast, Divider } from '@douyinfe/semi-ui';
import { vulnApi, type Vulnerability } from '@/lib/api';

const { Title, Text } = Typography;

export default function RepeaterPage() {
  const [vulnOptions, setVulnOptions] = useState<Vulnerability[]>([]);
  const [selectedVulnId, setSelectedVulnId] = useState<number | undefined>();

  const [requestPacket, setRequestPacket] = useState('');
  const [responseText, setResponseText] = useState('');
  const [responseBody, setResponseBody] = useState('');
  const [statusLine, setStatusLine] = useState('');
  const [loading, setLoading] = useState(false);
  const [contentType, setContentType] = useState('');

  useEffect(() => {
    const loadVulns = async () => {
      try {
        const res = await vulnApi.getVulnList({ page: 1, page_size: 100 });
        const vulns = res.data?.vulnerabilities || res.data?.vulns || [];
        setVulnOptions(vulns);
      } catch (error) {
        Toast.error('加载漏洞列表失败');
      }
    };
    loadVulns();
  }, []);

  const htmlPreview = useMemo(() => {
    if (!contentType.toLowerCase().includes('text/html')) return '';
    return responseBody;
  }, [contentType, responseBody]);

  const handleSelectVuln = async (value: number) => {
    setSelectedVulnId(value);
    try {
      const res = await vulnApi.getVuln(value);
      const packet = res.data?.request_packet || '';
      setRequestPacket(packet);
      if (!packet) {
        Toast.warning('该漏洞未填写请求数据包');
      }
    } catch (error) {
      Toast.error('加载漏洞详情失败');
    }
  };

  const handleSend = async () => {
    if (!requestPacket.trim()) {
      Toast.error('请先选择漏洞或输入请求数据包');
      return;
    }

    setLoading(true);
    try {
      const res = await vulnApi.replayRequestPacket(requestPacket);
      if (res.code === 200 && res.data) {
        setStatusLine(res.data.status_line || '');
        const headers = Object.entries(res.data.headers || {})
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n');
        setResponseBody(res.data.body || '');
        setResponseText(`${res.data.status_line}\n${headers}\n\n${res.data.body || ''}`);
        setContentType(res.data.content_type || '');
      } else {
        Toast.error(res.msg || '请求发送失败');
      }
    } catch (error) {
      Toast.error('请求发送失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Card title={<Title heading={4} style={{ margin: 0 }}>漏洞一键检测</Title>}>
        <Text type="secondary">先选择系统漏洞自动带入数据包，再发送请求查看响应与 HTML 渲染。</Text>

        <div style={{ marginTop: 16, marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Select
            placeholder="请选择漏洞（自动加载请求数据包）"
            value={selectedVulnId}
            onChange={(v) => handleSelectVuln(v as number)}
            style={{ width: 460, maxWidth: '100%' }}
            filter
          >
            {vulnOptions.map((v) => (
              <Select.Option key={v.id} value={v.id}>{v.title}</Select.Option>
            ))}
          </Select>
          <Button theme="solid" type="primary" loading={loading} onClick={handleSend}>发送数据包</Button>
        </div>

        <Divider margin="12px" />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16, alignItems: 'stretch' }}>
          <Card title="Request" style={{ height: '100%' }} bodyStyle={{ padding: 12, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <TextArea
              style={{ flex: 1 }}
              value={requestPacket}
              onChange={setRequestPacket}
              placeholder={'GET /api/user?id=1 HTTP/1.1\nHost: example.com\nCookie: session=xxx'}
              autosize={{ minRows: 18, maxRows: 26 }}
            />
          </Card>

          <Card title={`Response ${statusLine ? `(${statusLine})` : ''}`} style={{ height: '100%' }} bodyStyle={{ padding: 12, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <TextArea style={{ flex: 1 }} value={responseText} readonly autosize={{ minRows: 22, maxRows: 26 }} />
          </Card>
        </div>

        <Card title="HTML 预览" style={{ marginTop: 16 }} bodyStyle={{ padding: 0 }}>
          {htmlPreview ? (
            <iframe
              title="html-preview"
              srcDoc={htmlPreview}
              style={{ width: '100%', height: 420, border: 'none', background: '#fff' }}
              sandbox="allow-same-origin"
            />
          ) : (
            <div style={{ padding: 16 }}><Text type="secondary">当前响应不是 HTML，暂无渲染预览。</Text></div>
          )}
        </Card>
      </Card>
    </div>
  );
}
