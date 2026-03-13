'use client';

import { useMemo, useState } from 'react';
import { Button, Card, Input, Space, Typography } from '@douyinfe/semi-ui';
import { vulnApi } from '@/lib/api';

const { Title, Text } = Typography;

export default function RepeaterPage() {
  const [requestPacket, setRequestPacket] = useState('');
  const [responseText, setResponseText] = useState('');
  const [statusLine, setStatusLine] = useState('');
  const [loading, setLoading] = useState(false);
  const [contentType, setContentType] = useState('');

  const htmlPreview = useMemo(() => {
    if (!contentType.toLowerCase().includes('text/html')) return '';
    return responseText;
  }, [contentType, responseText]);

  const handleSend = async () => {
    setLoading(true);
    try {
      const res = await vulnApi.replayRequestPacket(requestPacket);
      if (res.code === 200 && res.data) {
        setStatusLine(res.data.status_line || '');
        const headers = Object.entries(res.data.headers || {})
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n');
        setResponseText(`${res.data.status_line}\n${headers}\n\n${res.data.body || ''}`);
        setContentType(res.data.content_type || '');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Card title={<Title heading={4} style={{ margin: 0 }}>漏洞一键检测</Title>}>
        <Text type="secondary">类似 Burp Repeater：编辑请求包、发送请求、查看响应和 HTML 渲染预览。</Text>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          <Card title="Request" bodyStyle={{ padding: 12 }}>
            <Input.TextArea
              value={requestPacket}
              onChange={setRequestPacket}
              placeholder={'GET /api/user?id=1 HTTP/1.1\nHost: example.com\nCookie: session=xxx'}
              autosize={{ minRows: 18, maxRows: 26 }}
            />
            <Space style={{ marginTop: 12 }}>
              <Button theme="solid" type="primary" loading={loading} onClick={handleSend}>发送请求</Button>
            </Space>
          </Card>

          <Card title={`Response ${statusLine ? `(${statusLine})` : ''}`} bodyStyle={{ padding: 12 }}>
            <Input.TextArea value={responseText} readonly autosize={{ minRows: 22, maxRows: 26 }} />
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
