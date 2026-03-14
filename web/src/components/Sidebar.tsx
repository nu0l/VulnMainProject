'use client';

import { Nav } from '@douyinfe/semi-ui';
import {
  IconHome,
  IconFolderOpen,
  IconSetting,
} from '@douyinfe/semi-icons';
import { useEffect, useState } from 'react';

interface User {
  id: number;
  username: string;
  email: string;
  real_name: string;
  phone: string;
  department: string;
  status: number;
  last_login_at: string;
  role_id: number;
}

interface SidebarProps {
  selectedKey?: string;
  onSelect?: (data: any) => void;
}

export default function Sidebar({ selectedKey = 'home', onSelect }: SidebarProps) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // 从 localStorage 获取用户信息
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        setUser(userData);
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  }, []);

  // 根据用户角色获取导航项
  const getNavigationItems = () => {
    const homeAndProject = [
      {
        itemKey: 'home',
        text: '首页',
        icon: <IconHome />
      },
      {
        itemKey: 'projects',
        text: '项目管理',
        icon: <IconFolderOpen />
      }
    ];

    const readOnlyMgmtItems = [
      {
        itemKey: 'assets',
        text: '资产面板',
        icon: <IconSetting />
      },
      {
        itemKey: 'knowledge',
        text: '知识库',
        icon: <IconSetting />
      },
      {
        itemKey: 'repeater',
        text: '漏洞一键检测',
        icon: <IconSetting />
      }
    ];

    // 超级管理员显示全部菜单
    if (user?.role_id === 1) {
      return [
        ...homeAndProject,
        {
          itemKey: 'assets',
          text: '资产面板',
          icon: <IconSetting />
        },
        {
          itemKey: 'users',
          text: '用户管理',
          icon: <IconSetting />
        },
        {
          itemKey: 'knowledge',
          text: '知识库',
          icon: <IconSetting />
        },
        {
          itemKey: 'repeater',
          text: '漏洞一键检测',
          icon: <IconSetting />
        },
        {
          itemKey: 'repeater',
          text: '漏洞一键检测',
          icon: <IconSetting />
        }
      ];
    }

    // 领导角色：只读管理视角（不含用户管理）
    if (user?.role_id === 5) {
      return [...homeAndProject, ...readOnlyMgmtItems];
    }

    // 安全/研发工程师可访问资产、知识库与检测模块
    if (user?.role_id === 2 || user?.role_id === 3) {
      return [
        ...homeAndProject,
        {
          itemKey: 'assets',
          text: '资产面板',
          icon: <IconSetting />
        },
        {
          itemKey: 'knowledge',
          text: '知识库',
          icon: <IconSetting />
        },
        {
          itemKey: 'repeater',
          text: '漏洞一键检测',
          icon: <IconSetting />
        }
      ];
    }

    return homeAndProject;
  };

  const handleSelect = (data: any) => {
    if (onSelect) {
      onSelect(data);
    }
  };

  return (
    <div style={{ 
      width: '240px', 
      height: '100vh', 
      borderRight: '1px solid var(--semi-color-border)' 
    }}>
      {/* 导航菜单 */}
      <Nav
        selectedKeys={[selectedKey]}
        onSelect={handleSelect}
        items={getNavigationItems()}
        style={{ 
          maxWidth: '100%',
          height: 'calc(100vh - 80px)',
          paddingTop: '24px'
        }}
        renderWrapper={({ itemElement, isSubNav, isInSubNav, props }) => {
          return (
            <div style={{ padding: '0 12px' }}>
              {itemElement}
            </div>
          );
        }}
      />

      {/* 底部版权信息 */}
      <div style={{
        position: 'absolute',
        bottom: '0',
        left: '0',
        right: '0',
        width: '240px',
        padding: '16px',
        borderTop: '1px solid var(--semi-color-border)',
        backgroundColor: 'var(--semi-color-bg-1)'
      }}>
        {/* 版权信息 */}
        <div style={{ 
          fontSize: '12px', 
          color: 'var(--semi-color-text-2)',
          textAlign: 'center'
        }}>
          © {new Date().getFullYear()} VulnMain
        </div>
      </div>
    </div>
  );
}

// 获取角色显示名称
function getRoleDisplayName(roleId: number): string {
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
} 