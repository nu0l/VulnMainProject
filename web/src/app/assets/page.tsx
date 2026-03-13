'use client';

import { useEffect, useState } from 'react';
import { assetApi, ASSET_IMPORTANCE_LEVELS, ASSET_TYPES, ENVIRONMENT_TYPES, projectApi, type Project } from '@/lib/api';
import { Button, Card, Form, Input, Select, Space, Toast, Typography } from '@douyinfe/semi-ui';
import { IconDownload, IconPlusCircle, IconUpload } from '@douyinfe/semi-icons';

const { Title, Text } = Typography;

const MLPS_LEVELS = ['一级', '二级', '三级', '四级', '五级'];

export default function AssetAdminPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number>();
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const loadProjects = async () => {
      const res = await projectApi.getProjectList({ page: 1, page_size: 200 });
      if (res.code === 200 && res.data) {
        setProjects(res.data.projects || []);
      }
    };
    loadProjects();
  }, []);

  const handleCreateAsset = async (values: any) => {
    if (!selectedProjectId) {
      Toast.error('请先选择项目');
      return;
    }

    try {
      setSubmitting(true);
      const response = await assetApi.createAsset({
        ...values,
        project_id: selectedProjectId,
      });
      if (response.code === 200) {
        Toast.success('资产录入成功');
      } else {
        Toast.error(response.msg || '资产录入失败');
      }
    } catch (error: any) {
      Toast.error(error?.response?.data?.msg || '资产录入失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await assetApi.downloadImportTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'asset_import_template.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
      Toast.success('模板下载成功');
    } catch {
      Toast.error('模板下载失败');
    }
  };

  const handleImport = async () => {
    if (!selectedProjectId) {
      Toast.error('请先选择项目');
      return;
    }
    if (!uploadFile) {
      Toast.error('请先选择要导入的文件');
      return;
    }

    try {
      setImporting(true);
      const response = await assetApi.importAssets(uploadFile, selectedProjectId);
      if (response.code === 200 && response.data) {
        Toast.success(`导入完成：成功 ${response.data.success_count} 条，失败 ${response.data.failure_count} 条`);
      } else {
        Toast.error(response.msg || '导入失败');
      }
    } catch (error: any) {
      Toast.error(error?.response?.data?.msg || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Title heading={3}>资产管理面板</Title>
      <Text type="secondary">管理员可下载模板、批量导入资产，并手动录入资产信息（IP、端口、建设单位、开发单位、负责部门、负责人、资产等级、等保等级等）。</Text>

      <Card style={{ marginTop: 16 }}>
        <Space vertical align="start" style={{ width: '100%' }}>
          <Title heading={5}>1) 选择目标项目</Title>
          <Select
            style={{ width: 420 }}
            placeholder="请选择项目"
            value={selectedProjectId}
            onChange={(value) => setSelectedProjectId(Number(value))}
          >
            {projects.map(project => (
              <Select.Option key={project.id} value={project.id}>{project.name}</Select.Option>
            ))}
          </Select>
        </Space>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Space vertical align="start" style={{ width: '100%' }}>
          <Title heading={5}>2) 批量导入资产</Title>
          <Space>
            <Button icon={<IconDownload />} onClick={handleDownloadTemplate}>下载导入模板</Button>
            <input type="file" accept=".xlsx,.xls" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
            <Button theme="solid" type="primary" icon={<IconUpload />} loading={importing} onClick={handleImport}>上传并导入</Button>
          </Space>
        </Space>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Title heading={5}>3) 手动录入资产</Title>
        <Form onSubmit={handleCreateAsset} labelPosition="left" style={{ marginTop: 16 }}>
          <Form.Input field="name" label="资产名称" rules={[{ required: true, message: '请输入资产名称' }]} />
          <Form.Select field="type" label="资产类型" rules={[{ required: true, message: '请选择资产类型' }]}>
            {ASSET_TYPES.map(t => <Select.Option key={t.value} value={t.value}>{t.label}</Select.Option>)}
          </Form.Select>
          <Form.Input field="ip" label="IP地址" rules={[{ required: true, message: '请输入IP地址' }]} />
          <Form.Input field="port" label="端口" rules={[{ required: true, message: '请输入端口' }]} />
          <Form.Input field="construction_unit" label="建设单位" />
          <Form.Input field="development_unit" label="开发单位" />
          <Form.Input field="responsible_dept" label="负责部门" />
          <Form.Input field="owner" label="负责人" />
          <Form.Input field="department" label="所属部门" />
          <Form.Select field="importance" label="资产等级" initValue="medium">
            {ASSET_IMPORTANCE_LEVELS.map(level => <Select.Option key={level.value} value={level.value}>{level.label}</Select.Option>)}
          </Form.Select>
          <Form.Select field="environment" label="环境" initValue="production">
            {ENVIRONMENT_TYPES.map(env => <Select.Option key={env.value} value={env.value}>{env.label}</Select.Option>)}
          </Form.Select>
          <Form.Select field="mlps_level" label="等保等级">
            {MLPS_LEVELS.map(level => <Select.Option key={level} value={level}>{level}</Select.Option>)}
          </Form.Select>
          <Form.Input field="os" label="操作系统" />
          <Form.Input field="domain" label="域名" />
          <Form.TextArea field="description" label="描述" />
          <Button htmlType="submit" theme="solid" type="primary" icon={<IconPlusCircle />} loading={submitting}>新增资产</Button>
        </Form>
      </Card>
    </div>
  );
}
