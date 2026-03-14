'use client';

import type { VulnTimeline } from '@/lib/api';
import { Spin, Typography } from '@douyinfe/semi-ui';

const { Title, Text } = Typography;

interface VulnTimelineViewerProps {
  timeline: VulnTimeline[];
  loading?: boolean;
  maxWidth?: number;
  showDragHint?: boolean;
}

function getTimelineStyle(action: string): { color: string; label: string } {
  switch (action) {
    case 'created':
      return { color: '#1890ff', label: '创建' };
    case 'assigned':
      return { color: '#fa8c16', label: '分配' };
    case 'unassigned':
      return { color: '#8c8c8c', label: '取消分配' };
    case 'updated':
      return { color: '#52c41a', label: '更新' };
    case 'status_changed':
      return { color: '#722ed1', label: '状态变更' };
    case 'deleted':
      return { color: '#f5222d', label: '删除' };
    case 'fixing':
      return { color: '#13c2c2', label: '修复中' };
    case 'fixed':
      return { color: '#52c41a', label: '已修复' };
    case 'retesting':
      return { color: '#722ed1', label: '复测中' };
    case 'completed':
      return { color: '#52c41a', label: '已完成' };
    case 'ignored':
      return { color: '#8c8c8c', label: '已忽略' };
    case 'rejected':
      return { color: '#f5222d', label: '已驳回' };
    default:
      return { color: '#1890ff', label: action };
  }
}

export default function VulnTimelineViewer({ timeline, loading = false, maxWidth, showDragHint = false }: VulnTimelineViewerProps) {
  return (
    <div>
      <style jsx>{`
        .timeline-container::-webkit-scrollbar {
          height: 6px;
        }
        .timeline-container::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 3px;
        }
        .timeline-container::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 3px;
        }
        .timeline-container::-webkit-scrollbar-thumb:hover {
          background: #a8a8a8;
        }
        .timeline-container {
          scrollbar-width: thin;
          scrollbar-color: #c1c1c1 #f1f1f1;
        }

        .timeline-node {
          transition: all 0.3s ease;
        }
        .timeline-node:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <Title heading={5} style={{ margin: 0, color: 'var(--semi-color-primary)' }}>处理时间线</Title>
        {showDragHint && timeline.length > 2 && (
          <Text type="tertiary" size="small">
            拖动查看更多 →
          </Text>
        )}
      </div>
      <div style={{
        padding: '16px 16px 8px 16px',
        border: '1px solid var(--semi-color-border)',
        borderRadius: '6px',
        backgroundColor: 'var(--semi-color-bg-0)',
        width: '100%',
        maxWidth: maxWidth ? `${maxWidth}px` : '100%',
        minHeight: '160px',
        overflow: 'visible'
      }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin />
            <Text type="secondary" style={{ marginLeft: '8px' }}>加载时间线...</Text>
          </div>
        ) : timeline.length > 0 ? (
          <div
            className="timeline-container"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '16px',
              overflowX: 'auto',
              overflowY: 'visible',
              padding: '4px 0 20px 0',
              scrollBehavior: 'smooth',
              cursor: 'grab',
              userSelect: 'none',
              minHeight: '110px',
              height: 'auto'
            }}
            onMouseDown={(e) => {
              const container = e.currentTarget;
              const startX = e.pageX - container.offsetLeft;
              const scrollLeft = container.scrollLeft;

              const handleMouseMove = (event: MouseEvent) => {
                const x = event.pageX - container.offsetLeft;
                const walk = (x - startX) * 2;
                container.scrollLeft = scrollLeft - walk;
                container.style.cursor = 'grabbing';
              };

              const handleMouseUp = () => {
                container.style.cursor = 'grab';
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };

              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.cursor = 'grab';
            }}
          >
            {timeline.map((item, index) => {
              const style = getTimelineStyle(item.action);
              return (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {index > 0 && (
                    <div style={{
                      width: '20px',
                      height: '2px',
                      backgroundColor: '#d9d9d9',
                      flexShrink: 0,
                      marginTop: '4px'
                    }} />
                  )}

                  <div
                    className="timeline-node"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      minWidth: '120px',
                      maxWidth: '140px',
                      padding: '10px 8px 12px 8px',
                      borderRadius: '8px',
                      backgroundColor: 'white',
                      border: `2px solid ${style.color}`,
                      boxShadow: '0 3px 8px rgba(0,0,0,0.12)',
                      position: 'relative',
                      flexShrink: 0,
                      minHeight: '100px',
                      overflow: 'visible'
                    }}
                  >
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: style.color,
                      marginBottom: '3px',
                      boxShadow: `0 0 0 2px rgba(${parseInt(style.color.slice(1, 3), 16)}, ${parseInt(style.color.slice(3, 5), 16)}, ${parseInt(style.color.slice(5, 7), 16)}, 0.2)`
                    }} />

                    <Text size="small" strong style={{
                      marginBottom: '4px',
                      color: style.color,
                      textAlign: 'center',
                      lineHeight: '1.1',
                      fontSize: '12px',
                      display: 'block',
                      fontWeight: '600'
                    }}>
                      {style.label}
                    </Text>

                    {item.description && (
                      <Text size="small" type="secondary" style={{
                        textAlign: 'center',
                        lineHeight: '1.2',
                        fontSize: '10px',
                        display: 'block',
                        marginBottom: '4px',
                        maxWidth: '130px',
                        wordBreak: 'break-word',
                        whiteSpace: 'normal',
                        padding: '2px 4px',
                        backgroundColor: 'rgba(0,0,0,0.02)',
                        borderRadius: '4px',
                        maxHeight: '32px',
                        overflow: 'hidden'
                      }}>
                        {item.description}
                      </Text>
                    )}

                    <div style={{ marginTop: 'auto', paddingTop: '4px' }}>
                      <Text size="small" type="tertiary" style={{
                        textAlign: 'center',
                        lineHeight: '1.1',
                        marginBottom: '2px',
                        fontSize: '10px',
                        display: 'block'
                      }}>
                        {new Date(item.created_at).toLocaleDateString('zh-CN', {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </Text>
                      <Text size="small" type="tertiary" style={{
                        textAlign: 'center',
                        lineHeight: '1.1',
                        fontSize: '9px',
                        display: 'block',
                        marginBottom: '2px'
                      }}>
                        {new Date(item.created_at).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Text>

                      {item.user && (
                        <Text size="small" type="secondary" style={{
                          textAlign: 'center',
                          fontSize: '9px',
                          maxWidth: '130px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'block',
                          backgroundColor: 'rgba(0,0,0,0.05)',
                          padding: '1px 4px',
                          borderRadius: '3px'
                        }}>
                          {item.user.real_name || item.user.username}
                        </Text>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Text type="tertiary">暂无时间线数据</Text>
          </div>
        )}
      </div>
    </div>
  );
}
