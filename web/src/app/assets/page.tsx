'use client';

import { useEffect, useState } from 'react';
import {
  assetApi,
  ASSET_IMPORTANCE_LEVELS,
  ASSET_TYPES,
  ENVIRONMENT_TYPES,
  projectApi,
  type Asset,
  type Project,
} from '@/lib/api';
import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Toast, Typography } from '@douyinfe/semi-ui';
import { IconDownload, IconEdit, IconPlus, IconUpload, IconDelete } from '@douyinfe/semi-icons';

const { Title, Text } = Typography;
const MLPS_LEVELS = ['一级', '二级', '三级', '四级', '五级'];

export default function AssetAdminPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number>();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadProjects = async () => {
      const res = await projectApi.getProjectList({ page: 1, page_size: 200 });
      if (res.code === 200 && res.data) {
        setProjects(res.data.projects || []);
      }
    };
    loadProjects();
  }, []);

  const loadAssets = async () => {
    if (!selectedProjectId) return;
    try {
      setLoading(true);
      const res = await assetApi.getAssetList({ page: 1, page_size: 200, keyword: keyword || undefined, project_id: selectedProjectId });
      if (res.code === 200 && res.data) {
        setAssets(res.data.assets || []);
      }
    } catch (e) {
      Toast.error('加载资产失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, [selectedProjectId]);

  const handleSaveAsset = async (values: any) => {
    if (!selectedProjectId) {
      Toast.error('请先选择项目');
      return;
    }
    try {
      setSaving(true);
      const payload = { ...values, project_id: selectedProjectId };
      const res = editingAsset ? await assetApi.updateAsset(editingAsset.id, payload) : await assetApi.createAsset(payload);
      if (res.code === 200) {
        Toast.success(editingAsset ? '资产更新成功' : '资产新增成功');
        setModalVisible(false);
        setEditingAsset(null);
        loadAssets();
      } else {
        Toast.error(res.msg || '保存失败');
      }
    } catch (error: any) {
      Toast.error(error?.response?.data?.msg || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (asset: Asset) => {
    try {
      const res = await assetApi.deleteAsset(asset.id);
      if (res.code === 200) {
        Toast.success('删除成功');
        loadAssets();
      } else {
        Toast.error(res.msg || '删除失败');
      }
    } catch (error: any) {
      Toast.error(error?.response?.data?.msg || '删除失败');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await assetApi.downloadImportTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'asset_import_template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      Toast.success('模板下载成功');
    } catch {
      Toast.error('模板下载失败');
    }
  };

  const handleImport = async () => {
    if (!selectedProjectId) return Toast.error('请先选择项目');
    if (!uploadFile) return Toast.error('请先选择导入文件');
    try {
      setImporting(true);
      const res = await assetApi.importAssets(uploadFile, selectedProjectId);
      if (res.code === 200 && res.data) {
        Toast.success(`导入完成：成功 ${res.data.success_count} 条，失败 ${res.data.failure_count} 条`);
        loadAssets();
      } else {
        Toast.error(res.msg || '导入失败');
      }
    } catch (error: any) {
      Toast.error(error?.response?.data?.msg || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const getFormInitValues = () => {
    if (!editingAsset) {
      return { importance: 'medium', environment: 'production' };
    }
    return {
      name: editingAsset.name,
      type: editingAsset.type,
      ip: editingAsset.ip,
      port: editingAsset.port,
      construction_unit: editingAsset.construction_unit,
      development_unit: editingAsset.development_unit,
      responsible_dept: editingAsset.responsible_dept,
      owner: editingAsset.owner,
      department: editingAsset.department,
      importance: editingAsset.importance,
      environment: editingAsset.environment,
      mlps_level: editingAsset.mlps_level,
      description: editingAsset.description,
    };
  };

  return (
    <div style={{ padding: 24 }}>
      <Title heading={3}>资产管理面板</Title>
      <Text type="secondary">支持资产列表查询、增删改查，以及模板导入。</Text>

      <Card style={{ marginTop: 16 }}>
        <Space wrap>
          <Select style={{ width: 320 }} placeholder="请选择项目" value={selectedProjectId} onChange={(v) => setSelectedProjectId(Number(v))}>
            {projects.map((p) => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}
          </Select>
          <Input value={keyword} onChange={setKeyword} placeholder="关键字（名称/IP/负责人）" style={{ width: 260 }} />
          <Button onClick={loadAssets}>查询</Button>
          <Button theme="solid" type="primary" icon={<IconPlus />} onClick={() => { setEditingAsset(null); setModalVisible(true); }}>新增资产</Button>
          <Button icon={<IconDownload />} onClick={handleDownloadTemplate}>下载导入模板</Button>
          <input type="file" accept=".xlsx,.xls" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
          <Button theme="solid" type="secondary" icon={<IconUpload />} loading={importing} onClick={handleImport}>导入资产</Button>
        </Space>
      </Card>

      <Card style={{ marginTop: 16 }} title="资产列表">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={assets}
          pagination={{ pageSize: 10 }}
          columns={[
            { title: '资产名称', dataIndex: 'name' },
            { title: '类型', dataIndex: 'type' },
            { title: 'IP', dataIndex: 'ip' },
            { title: '端口', dataIndex: 'port' },
            { title: '负责人', dataIndex: 'owner' },
            { title: '资产等级', dataIndex: 'importance' },
            { title: '等保等级', dataIndex: 'mlps_level' },
            {
              title: '操作',
              render: (_: any, record: Asset) => (
                <Space>
                  <Button icon={<IconEdit />} size="small" onClick={() => { setEditingAsset(record); setModalVisible(true); }}>编辑</Button>
                  <Popconfirm title="确认删除该资产？" onConfirm={() => handleDelete(record)}>
                    <Button icon={<IconDelete />} type="danger" size="small">删除</Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ] as any}
        />
      </Card>

      <Modal
        title={editingAsset ? '编辑资产' : '新增资产'}
        visible={modalVisible}
        onCancel={() => { setModalVisible(false); setEditingAsset(null); }}
        footer={null}
      >
        <Form
          initValues={getFormInitValues()}
          onSubmit={handleSaveAsset}
          labelPosition="left"
        >
          <Form.Input field="name" label="资产名称" rules={[{ required: true }]} />
          <Form.Select field="type" label="资产类型" rules={[{ required: true }]}>
            {ASSET_TYPES.map((t) => <Select.Option key={t.value} value={t.value}>{t.label}</Select.Option>)}
          </Form.Select>
          <Form.Input field="ip" label="IP地址" rules={[{ required: true }]} />
          <Form.Input field="port" label="端口" rules={[{ required: true }]} />
          <Form.Input field="construction_unit" label="建设单位" />
          <Form.Input field="development_unit" label="开发单位" />
          <Form.Input field="responsible_dept" label="负责部门" />
          <Form.Input field="owner" label="负责人" />
          <Form.Input field="department" label="所属部门" />
          <Form.Select field="importance" label="资产等级">
            {ASSET_IMPORTANCE_LEVELS.map((l) => <Select.Option key={l.value} value={l.value}>{l.label}</Select.Option>)}
          </Form.Select>
          <Form.Select field="environment" label="环境">
            {ENVIRONMENT_TYPES.map((e) => <Select.Option key={e.value} value={e.value}>{e.label}</Select.Option>)}
          </Form.Select>
          <Form.Select field="mlps_level" label="等保等级">
            {MLPS_LEVELS.map((l) => <Select.Option key={l} value={l}>{l}</Select.Option>)}
          </Form.Select>
          <Form.TextArea field="description" label="描述" />
          <Space>
            <Button htmlType="submit" theme="solid" type="primary" loading={saving}>保存</Button>
            <Button onClick={() => { setModalVisible(false); setEditingAsset(null); }}>取消</Button>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
