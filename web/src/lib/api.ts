import axios from 'axios';

// API 基础URL - 可以通过环境变量配置
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1/api';

// 后端基础URL（用于静态文件访问）
const BACKEND_BASE_URL = API_BASE_URL.replace('/api', '');

// 工具函数：处理图片URL，确保指向后端
export const resolveImageUrl = (imageUrl: string): string => {
  if (!imageUrl) return '';
  
  // 如果已经是完整URL，直接返回
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // 如果是相对路径，拼接后端基础URL
  if (imageUrl.startsWith('/uploads/')) {
    return `${BACKEND_BASE_URL}${imageUrl}`;
  }
  
  // 如果是其他相对路径，也拼接后端基础URL
  if (imageUrl.startsWith('/')) {
    return `${BACKEND_BASE_URL}${imageUrl}`;
  }
  
  // 其他情况，假设是相对于uploads目录的路径
  return `${BACKEND_BASE_URL}/uploads/${imageUrl}`;
};

// 创建 axios 实例
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加认证token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理统一错误
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // token 过期或无效，清除本地存储并跳转到登录页
      if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// 定义接口响应类型
export interface ApiResponse<T = any> {
  code: number;
  msg: string;
  data?: T;
}

export interface LoginRequest {
  username: string;
  password: string;
  second_factor_code?: string;
}

export interface LoginResponse {
  token: string;
  refresh_token: string;
  user: {
    id: number;
    username: string;
    email: string;
    real_name: string;
    phone: string;
    department: string;
    status: number;
    last_login_at: string;
    role_id: number;
  };
}

export interface QrLoginStartResponse {
  session_id: string;
  qrcode_url: string;
  provider: string;
  expires_in: number;
  enabled: boolean;
}

export interface QrLoginCallbackRequest {
  session_id: string;
  provider_user_id: string;
  username?: string;
  email?: string;
  real_name?: string;
  department?: string;
  phone?: string;
}

export interface SystemInfo {
  system_name: string;
  system_title: string;
  company_name: string;
  logo: string;
  login_background?: string;
  version: string;
  mfa_enabled?: boolean;
  mfa_optional?: boolean;
  qrcode_enabled?: boolean;
}

// 系统配置接口
export interface SystemConfig {
  id: number;
  key: string;
  value: string;
  type: string;
  group: string;
  description: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConfigUpdateRequest {
  value: string;
  description?: string;
}

export interface ConfigCreateRequest {
  key: string;
  value: string;
  type: string;
  group: string;
  description?: string;
  is_public?: boolean;
}

// 系统信息接口
export const systemApi = {
  // 获取公开的系统信息（无需认证）
  getPublicInfo: async (): Promise<ApiResponse<SystemInfo>> => {
    const response = await api.get('/system/info');
    return response.data;
  },

  // 获取系统配置列表
  getConfigs: async (group?: string, isPublic?: boolean): Promise<ApiResponse<SystemConfig[]>> => {
    const params = new URLSearchParams();
    if (group) params.append('group', group);
    if (isPublic !== undefined) params.append('public', isPublic.toString());
    
    const response = await api.get(`/system/configs?${params.toString()}`);
    return response.data;
  },

  // 获取单个系统配置
  getConfig: async (key: string): Promise<ApiResponse<SystemConfig>> => {
    const response = await api.get(`/system/configs/${key}`);
    return response.data;
  },

  // 获取上传配置
  getUploadConfig: async (): Promise<ApiResponse<SystemConfig[]>> => {
    const response = await api.get('/system/configs?group=upload&public=true');
    return response.data;
  },

  // 更新系统配置
  updateConfig: async (key: string, data: ConfigUpdateRequest): Promise<ApiResponse> => {
    const response = await api.put(`/system/configs/${key}`, data);
    return response.data;
  },

  // 创建系统配置
  createConfig: async (data: ConfigCreateRequest): Promise<ApiResponse> => {
    const response = await api.post('/system/configs', data);
    return response.data;
  },

  // 删除系统配置
  deleteConfig: async (key: string): Promise<ApiResponse> => {
    const response = await api.delete(`/system/configs/${key}`);
    return response.data;
  },

  // 测试邮件配置
  testEmailConfig: async (data: { test_email: string }): Promise<ApiResponse> => {
    const response = await api.post('/system/email/test', data);
    return response.data;
  },

  // 测试LDAP配置
  testLDAPConfig: async (): Promise<ApiResponse> => {
    const response = await api.post('/system/ldap/test', {});
    return response.data;
  },

  // 手动同步LDAP用户
  syncLDAPUsers: async (): Promise<ApiResponse<{created: number; updated: number;}>> => {
    const response = await api.post('/system/ldap/sync', {});
    return response.data;
  },
};

// API 函数
export const authApi = {
  // 用户登录
  login: async (data: LoginRequest): Promise<ApiResponse<LoginResponse>> => {
    const response = await api.post('/login', data);
    return response.data;
  },

  // 启动扫码登录
  startQrLogin: async (): Promise<ApiResponse<QrLoginStartResponse>> => {
    const response = await api.post('/login/qrcode/start');
    return response.data;
  },

  // 扫码登录回调（后续可由后端对接第三方后自动触发）
  qrLoginCallback: async (data: QrLoginCallbackRequest): Promise<ApiResponse<LoginResponse>> => {
    const response = await api.post('/login/qrcode/callback', data);
    return response.data;
  },

  // 刷新token
  refreshToken: async (token: string): Promise<ApiResponse<LoginResponse>> => {
    const response = await api.post('/refresh', { token });
    return response.data;
  },

  // 获取用户信息
  getUserInfo: async (): Promise<ApiResponse<LoginResponse['user']>> => {
    const response = await api.get('/user/info');
    return response.data;
  },

  // 用户登出
  logout: async (): Promise<ApiResponse> => {
    const response = await api.post('/logout');
    return response.data;
  },

  // 获取仪表板数据
  getDashboardData: async (): Promise<ApiResponse<DashboardData>> => {
    const response = await api.get('/dashboard/data');
    return response.data;
  },

  // 获取密码策略（兼容旧调用）
  getPasswordPolicy: async (): Promise<ApiResponse<{
    policy: {
      min_length: number;
      require_uppercase: boolean;
      require_lowercase: boolean;
      require_number: boolean;
      require_special: boolean;
    };
    requirements: string[];
  }>> => {
    const response = await api.get('/password/policy');
    return response.data;
  },
};

// 仪表板数据类型定义
export interface DashboardData {
  total_vulns: number;
  total_projects: number;
  total_assets?: number;
  due_soon_vulns: number;
  vuln_status_stats: Record<string, number>;
  asset_type_stats?: Record<string, number>;
  security_engineer_ranking?: EngineerRankingItem[];
  dev_engineer_ranking?: EngineerRankingItem[];
  latest_vulns: VulnListItem[];
  current_user_vulns?: UserVulnStats;
}

export interface EngineerRankingItem {
  user_id: number;
  username: string;
  real_name: string;
  count: number;
}

export interface VulnListItem {
  id: number;
  title: string;
  severity: string;
  status: string;
  project_name: string;
  reporter_name: string;
  submitted_at: string;
  fix_deadline?: string;
}

export interface UserVulnStats {
  total_count: number;      // 所有历史漏洞总数
  monthly_count: number;    // 当月提交漏洞数
  status_stats: Record<string, number>;
  due_soon_count: number;
}

// 工具函数
export const authUtils = {
  // 保存登录信息
  saveLoginInfo: (data: LoginResponse) => {
    if (typeof window !== 'undefined') {
    localStorage.setItem('token', data.token);
    localStorage.setItem('refresh_token', data.refresh_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    }
  },

  // 清除登录信息
  clearLoginInfo: () => {
    if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    }
  },

  // 获取当前用户
  getCurrentUser: () => {
    if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
    }
    return null;
  },

  // 检查是否已登录
  isLoggedIn: () => {
    if (typeof window !== 'undefined') {
    return !!localStorage.getItem('token');
    }
    return false;
  },

  // 检查用户角色ID
  hasRoleId: (roleId: number): boolean => {
    const user = authUtils.getCurrentUser();
    return user?.role_id === roleId;
  },

  // 获取角色代码
  getRoleCode: (roleId: number): string => {
    switch (roleId) {
      case 1:
        return 'super_admin';
      case 2:
        return 'security_engineer';
      case 3:
        return 'dev_engineer';
      case 4:
        return 'normal_user';
      case 5:
        return 'leader';
      default:
        return 'unknown';
    }
  },

  // 获取角色显示名称
  getRoleDisplayName: (roleId: number): string => {
    switch (roleId) {
      case 1:
        return '超级管理员';
      case 2:
        return '安全工程师';
      case 3:
        return '研发工程师';
      case 4:
        return '普通用户';
      case 5:
        return '领导';
      default:
        return '未知角色';
    }
  },
};

// 项目管理API
export const projectApi = {
  // 获取项目列表
  getProjectList: async (params?: {
    page?: number;
    page_size?: number;
    keyword?: string;
    type?: string;
    status?: string;
  }): Promise<ApiResponse<ProjectListResponse>> => {
    const response = await api.get('/projects', { params });
    return response.data;
  },

  // 获取项目详情
  getProject: async (id: number): Promise<ApiResponse<Project>> => {
    const response = await api.get(`/projects/${id}`);
    return response.data;
  },

  // 创建项目
  createProject: async (data: ProjectCreateRequest): Promise<ApiResponse<Project>> => {
    const response = await api.post('/projects', data);
    return response.data;
  },

  // 更新项目
  updateProject: async (id: number, data: ProjectUpdateRequest): Promise<ApiResponse<Project>> => {
    const response = await api.put(`/projects/${id}`, data);
    return response.data;
  },

  // 删除项目
  deleteProject: async (id: number): Promise<ApiResponse> => {
    const response = await api.delete(`/projects/${id}`);
    return response.data;
  },

  // 获取用户项目列表
  getUserProjects: async (): Promise<ApiResponse<Project[]>> => {
    const response = await api.get('/user/projects');
    return response.data;
  },

  // 刷新项目统计数据
  refreshStats: async (): Promise<ApiResponse> => {
    const response = await api.post('/projects/refresh-stats');
    return response.data;
  },
};

// 用户管理API
export const userApi = {
  // 获取用户列表
  getUserList: async (params?: {
    page?: number;
    page_size?: number;
    keyword?: string;
    role_id?: number;
    status?: number;
  }): Promise<ApiResponse<UserListResponse>> => {
    const response = await api.get('/users', { params });
    return response.data;
  },

  // 获取工程师列表（安全工程师和研发工程师）
  getEngineers: async (): Promise<ApiResponse<User[]>> => {
    const response = await api.get('/users/engineers');
    return response.data;
  },

  // 获取安全工程师列表
  getSecurityEngineers: async (): Promise<ApiResponse<User[]>> => {
    const response = await api.get('/users/security-engineers');
    return response.data;
  },

  // 获取研发工程师列表
  getDevEngineers: async (): Promise<ApiResponse<User[]>> => {
    const response = await api.get('/users/dev-engineers');
    return response.data;
  },

  // 获取用户详情
  getUser: async (id: number): Promise<ApiResponse<User>> => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  // 创建用户
  createUser: async (data: UserCreateRequest): Promise<ApiResponse<User>> => {
    const response = await api.post('/users', data);
    return response.data;
  },

  // 更新用户
  updateUser: async (id: number, data: UserUpdateRequest): Promise<ApiResponse<User>> => {
    const response = await api.put(`/users/${id}`, data);
    return response.data;
  },

  // 删除用户
  deleteUser: async (id: number): Promise<ApiResponse> => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },

  // 切换用户状态
  toggleUserStatus: async (id: number): Promise<ApiResponse> => {
    const response = await api.put(`/users/${id}/toggle-status`);
    return response.data;
  },

  // 重置用户密码
  resetPassword: async (id: number, newPassword: string): Promise<ApiResponse> => {
    const response = await api.put(`/users/${id}/reset-password`, { new_password: newPassword });
    return response.data;
  },

  // 获取用户统计
  getUserStats: async (): Promise<ApiResponse<UserStatsResponse>> => {
    const response = await api.get('/users/stats');
    return response.data;
  },

  // 获取角色列表
  getRoles: async (): Promise<ApiResponse<Role[]>> => {
    const response = await api.get('/roles');
    return response.data;
  },

  // 修改个人信息
  updateProfile: async (data: {
    real_name?: string;
    email?: string;
    phone?: string;
    department?: string;
  }): Promise<ApiResponse<User>> => {
    const response = await api.put('/user/profile', data);
    return response.data;
  },

    // 修改密码
  changePassword: async (data: {
    old_password: string;
    new_password: string;
  }): Promise<ApiResponse<void>> => {
    const response = await api.put('/user/password', data);
    return response.data;
  },

  // 获取密码策略
  getPasswordPolicy: async (): Promise<ApiResponse<{
    policy: {
      min_length: number;
      require_uppercase: boolean;
      require_lowercase: boolean;
      require_number: boolean;
      require_special: boolean;
    };
    requirements: string[];
  }>> => {
    const response = await api.get('/password/policy');
    return response.data;
  },

  // 上传漏洞图片
  uploadVulnImage: async (file: File): Promise<ApiResponse<{ image_url: string }>> => {
    const formData = new FormData();
    formData.append('image', file);

    const response = await api.post('/upload/vuln-image', formData, {
      headers: {
        'Content-Type': undefined, // 让axios自动设置multipart/form-data
      },
    });
    return response.data;
  },
};

// 周报API
export const weeklyReportApi = {
  // 获取周报数据
  getWeeklyReportData: async (): Promise<ApiResponse<WeeklyReportData>> => {
    const response = await api.get('/system/weekly-report/data');
    return response.data;
  },

  // 获取月报数据
  getMonthlyReportData: async (): Promise<ApiResponse<any>> => {
    const response = await api.get('/system/weekly-report/monthly/data');
    return response.data;
  },

  // 获取年报数据
  getYearlyReportData: async (): Promise<ApiResponse<any>> => {
    const response = await api.get('/system/weekly-report/yearly/data');
    return response.data;
  },

  // 预览周报PDF
  previewWeeklyReportPDF: async (): Promise<Blob> => {
    const response = await api.get('/system/weekly-report/preview', {
      responseType: 'blob'
    });
    return response.data;
  },

  // 下载周报PDF
  downloadWeeklyReportPDF: async (): Promise<Blob> => {
    const response = await api.get('/system/weekly-report/download', {
      responseType: 'blob'
    });
    return response.data;
  },

  // 手动发送周报
  sendWeeklyReport: async (): Promise<ApiResponse<void>> => {
    const response = await api.post('/system/weekly-report/send');
    return response.data;
  },

  // 获取定时任务状态
  getSchedulerStatus: async (): Promise<ApiResponse<SchedulerStatus>> => {
    const response = await api.get('/system/weekly-report/scheduler/status');
    return response.data;
  },

  // 手动触发定时发送
  manualSendWeeklyReport: async (): Promise<ApiResponse<void>> => {
    const response = await api.post('/system/weekly-report/scheduler/send');
    return response.data;
  },

  // 获取周报历史记录
  getWeeklyReportHistory: async (page: number = 1, pageSize: number = 10): Promise<ApiResponse<{
    list: WeeklyReportRecord[];
    total: number;
    page: number;
    pageSize: number;
  }>> => {
    const response = await api.get('/system/weekly-report/history', {
      params: { page, pageSize }
    });
    return response.data;
  },

  // 手动生成并发送周报
  generateWeeklyReport: async (): Promise<ApiResponse<void>> => {
    const response = await api.post('/system/weekly-report/generate');
    return response.data;
  },
};

// 项目类型定义
export interface Project {
  id: number;
  name: string;
  type: string;
  priority: string;
  description: string;
  owner_id: number;
  owner: User;
  start_date?: string;
  end_date?: string;
  is_public: boolean;
  status: string;
  members: ProjectMember[];
  assets?: Asset[];
  vulnerabilities?: Vulnerability[];
  created_by: number;
  creator: User;
  created_at: string;
  updated_at: string;
  can_submit_vulns?: boolean;
  member_count?: number;
  asset_count?: number;
  vuln_count?: number;
}

export interface ProjectMember {
  id: number;
  project_id: number;
  user_id: number;
  user: User;
  role: string;
  joined_at: string;
}

export interface ProjectCreateRequest {
  name: string;
  type: string;
  priority: string;
  description: string;
  owner_id: number;
  start_date?: string;
  end_date?: string;
  is_public: boolean;
  member_ids?: number[];
}

export interface ProjectUpdateRequest {
  name?: string;
  type?: string;
  priority?: string;
  description?: string;
  owner_id?: number;
  start_date?: string;
  end_date?: string;
  is_public?: boolean;
  status?: string;
  member_ids?: number[];
}

export interface ProjectListResponse {
  projects: Project[];
  total: number;
  page: number;
  page_size: number;
}

// 用户类型定义
export interface User {
  ID: number; // 后端返回的是大写ID
  id?: number; // 兼容性字段
  username: string;
  email: string;
  real_name: string;
  phone: string;
  department: string;
  status: number;
  last_login_at: string;
  role_id: number;
  role: Role;
  source?: string; // 账户来源：local/ldap
  CreatedAt?: string; // 后端字段
  UpdatedAt?: string; // 后端字段
  created_at?: string; // 兼容性字段
  updated_at?: string; // 兼容性字段
}

export interface Role {
  id: number;
  name: string;
  code: string;
  description: string;
}

export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  page_size: number;
}

// 用户创建请求类型
export interface UserCreateRequest {
  username: string;
  email: string;
  phone: string;
  password: string;
  real_name: string;
  department: string;
  role_id: number;
  status?: number;
}

// 用户更新请求类型
export interface UserUpdateRequest {
  username?: string;
  email?: string;
  phone?: string;
  real_name?: string;
  department?: string;
  role_id?: number;
  status?: number;
}

// 用户统计响应类型
export interface UserStatsResponse {
  total_users: number;
  active_users: number;
  inactive_users: number;
  role_stats: Array<{
    role_name: string;
    count: number;
  }>;
}

// 资产类型定义
export interface Asset {
  id: number;
  name: string;
  type: string;
  domain?: string;
  ip: string;
  port: string;
  os?: string;
  owner: string;
  construction_unit?: string;
  development_unit?: string;
  responsible_dept?: string;
  environment: string;
  department: string;
  importance: string;
  mlps_level?: string;
  project_id: number;
  project: Project;
  asset_group_id?: number;
  created_by: number;
  creator: User;
  tags?: string;
  status: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface AssetListResponse {
  assets: Asset[];
  total: number;
  page: number;
  page_size: number;
  current_page: number;
  total_pages: number;
}

// 漏洞类型定义
export interface Vulnerability {
  id: number;
  title: string;
  vuln_url?: string;
  description: string;
  vuln_type: string;
  severity: string;
  status: string;
  cve_id?: string;
  fix_suggestion?: string;
  project_id: number;
  project: Project;
  asset_id: number;
  asset: Asset;
  reporter_id: number;
  reporter: User;
  assignee_id?: number;
  assignee?: User;
  fixed_by?: number;
  fixer?: User;
  retester_id?: number;
  retester?: User;
  submitted_at: string;
  assigned_at?: string;
  fix_started_at?: string;
  fixed_at?: string;
  retest_at?: string;
  completed_at?: string;
  ignored_at?: string;
  ignore_reason?: string;
  rejected_at?: string;
  rejected_by?: number;
  rejector?: User;
  reject_reason?: string;
  resubmitted_at?: string;
  resubmitted_by?: number;
  resubmitter?: User;
  fix_deadline?: string;
  retest_result?: string;
  tags?: string;
  comments?: VulnComment[];
  created_at: string;
  updated_at: string;
}

export interface VulnComment {
  id: number;
  vuln_id: number;
  content: string;
  user_id: number;
  user: User;
  created_at: string;
  updated_at: string;
}

// 漏洞时间线类型定义
export interface VulnTimeline {
  id: number;
  vuln_id: number;
  action: string;
  description: string;
  user_id: number;
  user: User;
  created_at: string;
}

// 项目类型枚举
export const PROJECT_TYPES = [
  { value: 'web_project', label: 'Web项目' },
  { value: 'api_interface', label: 'API接口' },
  { value: 'mobile_app', label: '移动应用' },
  { value: 'software_app', label: '软件应用' },
];

// 优先级枚举
export const PROJECT_PRIORITIES = [
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
];

// 项目状态枚举
export const PROJECT_STATUSES = [
  { value: 'active', label: '活跃' },
  { value: 'inactive', label: '非活跃' },
  { value: 'completed', label: '已完成' },
  { value: 'archived', label: '已归档' },
];

// 用户角色枚举
export const USER_ROLES = [
  { value: 1, label: '超级管理员', code: 'super_admin' },
  { value: 2, label: '安全工程师', code: 'security_engineer' },
  { value: 3, label: '研发工程师', code: 'dev_engineer' },
  { value: 4, label: '普通用户', code: 'normal_user' },
  { value: 5, label: '领导', code: 'leader' },
];

// 用户状态枚举
export const USER_STATUSES = [
  { value: 1, label: '启用' },
  { value: 0, label: '禁用' },
];

// 漏洞严重程度枚举
export const VULN_SEVERITIES = [
  { value: 'critical', label: '严重', color: 'red' },
  { value: 'high', label: '高危', color: 'orange' },
  { value: 'medium', label: '中危', color: 'yellow' },
  { value: 'low', label: '低危', color: 'blue' },
  { value: 'info', label: '提示', color: 'grey' },
];

// 漏洞状态枚举
export const VULN_STATUSES = [
  { value: 'unfixed', label: '未修复', color: 'red' },
  { value: 'fixing', label: '修复中', color: 'orange' },
  { value: 'fixed', label: '已修复', color: 'green' },
  { value: 'retesting', label: '复测中', color: 'blue' },
  { value: 'completed', label: '已完成', color: 'light-green' },
  { value: 'ignored', label: '已忽略', color: 'grey' },
  { value: 'rejected', label: '驳回', color: 'purple' },
];

// 漏洞类型枚举
export const VULN_TYPES = [
  'SQL注入',
  'XSS跨站脚本',
  'CSRF跨站请求伪造',
  '命令执行',
  '文件上传',
  '敏感信息泄露',
  '权限绕过',
  '逻辑漏洞',
  '配置错误',
  '其他'
];

// 资产类型枚举
export const ASSET_TYPES = [
  { value: 'server', label: '服务器' },
  { value: 'network_device', label: '网络设备' },
  { value: 'database', label: '数据库' },
  { value: 'storage_device', label: '存储设备' },
  { value: 'custom', label: '自定义类型' },
];

// 操作系统枚举
export const OS_TYPES = [
  'CentOS',
  'Windows',
  'Ubuntu',
  'Debian',
  'Red Hat',
  '龙蜥（Anolis）',
  '其他'
];

// 环境类型枚举
export const ENVIRONMENT_TYPES = [
  { value: 'production', label: '生产环境' },
  { value: 'pre_production', label: '准生产环境' },
  { value: 'staging', label: '预发环境' },
  { value: 'testing', label: '测试环境' },
  { value: 'development', label: '开发环境' },
  { value: 'disaster_recovery', label: '容灾环境' },
];

// 资产重要性枚举
export const ASSET_IMPORTANCE_LEVELS = [
  { value: 'extremely_high', label: '极高', color: 'red' },
  { value: 'high', label: '高', color: 'orange' },
  { value: 'medium', label: '中', color: 'yellow' },
  { value: 'low', label: '低', color: 'green' },
];

// 漏洞创建请求类型
export interface VulnCreateRequest {
  title: string;
  vuln_url: string; // 漏洞地址改为必填
  description: string;
  vuln_type: string;
  severity: string;
  cve_id?: string;
  fix_suggestion: string; // 修复建议改为必填
  project_id: number;
  asset_id: number;
  assignee_id: number; // 指派给改为必填
  fix_deadline: string; // 修复截止时间改为必填
  tags?: string;
}

// 漏洞更新请求类型
export interface VulnUpdateRequest {
  title?: string;
  vuln_url?: string;
  description?: string;
  vuln_type?: string;
  severity?: string;
  cve_id?: string;
  fix_suggestion?: string;
  asset_id?: number;
  assignee_id?: number;
  fix_deadline?: string;
  tags?: string;
  status?: string;
  ignore_reason?: string;
  retest_result?: string;
  reject_reason?: string;
  comment?: string;
  resubmitted_at?: string;
  resubmitted_by?: number;
}

// 资产创建请求类型
export interface AssetCreateRequest {
  name: string;
  type: string;
  domain?: string;
  ip: string;
  port: string;
  os?: string;
  owner: string;
  construction_unit?: string;
  development_unit?: string;
  responsible_dept?: string;
  environment: string;
  department: string;
  importance: string;
  mlps_level?: string;
  project_id: number;
  tags?: string;
  description?: string;
}

// 资产更新请求类型
export interface AssetUpdateRequest {
  name?: string;
  type?: string;
  domain?: string;
  ip?: string;
  port?: string;
  os?: string;
  owner?: string;
  environment?: string;
  department?: string;
  importance?: string;
  tags?: string;
  description?: string;
}

// 漏洞管理API
export const vulnApi = {
  // 获取项目漏洞列表
  getProjectVulns: async (projectId: number): Promise<ApiResponse<Vulnerability[]>> => {
    const response = await api.get(`/projects/${projectId}/vulnerabilities`);
    return response.data;
  },

  // 获取漏洞详情
  getVuln: async (id: number): Promise<ApiResponse<Vulnerability>> => {
    const response = await api.get(`/vulns/${id}`);
    return response.data;
  },

  // 创建漏洞
  createVuln: async (data: VulnCreateRequest): Promise<ApiResponse<Vulnerability>> => {
    const response = await api.post('/vulns', data);
    return response.data;
  },

  // 更新漏洞
  updateVuln: async (id: number, data: VulnUpdateRequest): Promise<ApiResponse<Vulnerability>> => {
    const response = await api.put(`/vulns/${id}`, data);
    return response.data;
  },

  // 删除漏洞
  deleteVuln: async (id: number): Promise<ApiResponse> => {
    const response = await api.delete(`/vulns/${id}`);
    return response.data;
  },

  // 指派漏洞
  assignVuln: async (id: number, assigneeId: number): Promise<ApiResponse> => {
    const response = await api.put(`/vulns/${id}/assign`, { assignee_id: assigneeId });
    return response.data;
  },

  // 修复漏洞
  fixVuln: async (id: number): Promise<ApiResponse> => {
    const response = await api.put(`/vulns/${id}/fix`);
    return response.data;
  },

  // 复测漏洞
  retestVuln: async (id: number, result?: string): Promise<ApiResponse> => {
    const response = await api.put(`/vulns/${id}/retest`, { retest_result: result });
    return response.data;
  },

  // 获取漏洞时间线
  getVulnTimeline: async (id: number): Promise<ApiResponse<VulnTimeline[]>> => {
    const response = await api.get(`/vulns/${id}/timeline`);
    return response.data;
  },

  // 忽略漏洞
  ignoreVuln: async (id: number, reason: string): Promise<ApiResponse> => {
    const response = await api.put(`/vulns/${id}/ignore`, { ignore_reason: reason });
    return response.data;
  },

  // 批量导出漏洞
  exportVulns: async (vulnIds: number[], projectId: number): Promise<Blob> => {
    const response = await api.post('/vulns/export', {
      vuln_ids: vulnIds,
      project_id: projectId,
    }, {
      responseType: 'blob',
    });
    return response.data;
  },

  // 批量导入漏洞
  importVulns: async (file: File, projectId: number): Promise<ApiResponse<any>> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('project_id', projectId.toString());

    const response = await api.post('/vulns/import', formData, {
      headers: {
        'Content-Type': undefined,
      },
    });
    return response.data;
  },

  // 下载漏洞导入模板
  downloadImportTemplate: async (): Promise<Blob> => {
    const response = await api.get('/vulns/import/template', {
      responseType: 'blob',
    });
    return response.data;
  },

  // AI修复建议
  generateAIFixSuggestion: async (id: number): Promise<ApiResponse<{content: string}>> => {
    const response = await api.post(`/vulns/${id}/ai-fix-suggestion`);
    return response.data;
  },

  // 历史修复策略推荐
  recommendFixStrategies: async (id: number): Promise<ApiResponse<any[]>> => {
    const response = await api.get(`/vulns/${id}/recommend-fixes`);
    return response.data;
  },

  // 导出合规模板报告
  exportComplianceReport: async (standard: 'mlps2' | 'iso27001' | 'finance', projectId?: number): Promise<Blob> => {
    const response = await api.get('/vulns/compliance/export', {
      params: {
        standard,
        project_id: projectId,
      },
      responseType: 'blob',
    });
    return response.data;
  },
};



// 资产管理API
export const assetApi = {
  // 获取项目资产列表
  getProjectAssets: async (projectId: number): Promise<ApiResponse<Asset[]>> => {
    const response = await api.get(`/projects/${projectId}/assets`);
    return response.data;
  },

  // 获取资产列表（支持分页/过滤）
  getAssetList: async (params?: {
    page?: number;
    page_size?: number;
    keyword?: string;
    project_id?: number;
  }): Promise<ApiResponse<AssetListResponse>> => {
    const response = await api.get('/assets', { params });
    return response.data;
  },

  // 创建资产
  createAsset: async (data: AssetCreateRequest): Promise<ApiResponse<Asset>> => {
    const response = await api.post('/assets', data);
    return response.data;
  },

  // 更新资产
  updateAsset: async (id: number, data: AssetUpdateRequest): Promise<ApiResponse<Asset>> => {
    const response = await api.put(`/assets/${id}`, data);
    return response.data;
  },

  // 删除资产
  deleteAsset: async (id: number): Promise<ApiResponse> => {
    const response = await api.delete(`/assets/${id}`);
    return response.data;
  },



  // 批量导出资产
  exportAssets: async (assetIds: number[], projectId: number): Promise<Blob> => {
    const response = await api.post('/assets/export', {
      asset_ids: assetIds,
      project_id: projectId,
    }, {
      responseType: 'blob',
    });
    return response.data;
  },

  // 批量导入资产
  importAssets: async (file: File, projectId: number): Promise<ApiResponse<any>> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('project_id', projectId.toString());

    const response = await api.post('/assets/import', formData, {
      headers: {
        // 删除默认的Content-Type，让浏览器自动设置multipart/form-data
        'Content-Type': undefined,
      },
    });
    return response.data;
  },

  // 下载资产导入模板
  downloadImportTemplate: async (): Promise<Blob> => {
    const response = await api.get('/assets/import/template', {
      responseType: 'blob',
    });
    return response.data;
  },
};

// 周报相关类型定义
export interface WeeklyReportData {
  week_start: string;
  week_end: string;
  total_submitted: number;
  total_fixed: number;
  total_fixing: number;
  total_retesting: number;
  security_engineer_ranking: EngineerWeeklyRanking[];
  dev_engineer_ranking: EngineerWeeklyRanking[];
  project_vuln_ranking: ProjectWeeklyRanking[];
  severity_stats: Record<string, number>;
  status_stats: Record<string, number>;
  generated_at: string;
}

export interface EngineerWeeklyRanking {
  user_id: number;
  username: string;
  real_name: string;
  count: number;
  department: string;
}

export interface ProjectWeeklyRanking {
  project_id: number;
  project_name: string;
  vuln_count: number;
  owner_name: string;
}

export interface SchedulerStatus {
  running: boolean;
  task_count: number;
  tasks: SchedulerTask[];
}

export interface SchedulerTask {
  id: number;
  name: string;
  schedule: string;
  next_run: string;
  prev_run: string;
}

export interface WeeklyReportRecord {
  id: number;
  week_start: string;
  week_end: string;
  file_name: string;
  file_path: string;
  file_size: number;
  total_submitted: number;
  total_fixed: number;
  total_fixing: number;
  total_retesting: number;
  generated_by: number;
  generated_by_name: string;
  sent_to: string;
  sent_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export default api;


export const knowledgeApi = {
  list: async (params?: { page?: number; page_size?: number; keyword?: string; vuln_type?: string }): Promise<ApiResponse<any>> => {
    const response = await api.get('/knowledge', { params });
    return response.data;
  },
  create: async (data: any): Promise<ApiResponse<any>> => {
    const response = await api.post('/knowledge', data);
    return response.data;
  },
  update: async (id: number, data: any): Promise<ApiResponse<any>> => {
    const response = await api.put(`/knowledge/${id}`, data);
    return response.data;
  },
  remove: async (id: number): Promise<ApiResponse<any>> => {
    const response = await api.delete(`/knowledge/${id}`);
    return response.data;
  },
  recommend: async (vulnType: string, severity?: string): Promise<ApiResponse<any[]>> => {
    const response = await api.get('/knowledge/recommend', {
      params: { vuln_type: vulnType, severity },
    });
    return response.data;
  },
};
