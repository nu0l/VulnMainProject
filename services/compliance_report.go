package services

import (
	"bytes"
	"errors"
	"fmt"
	"time"
	Init "vulnmain/Init"
	"vulnmain/models"
)

type ComplianceReportService struct{}

func (s *ComplianceReportService) ExportMarkdown(standard string, projectID *uint) ([]byte, string, error) {
	db := Init.GetDB()
	q := db.Model(&models.Vulnerability{}).Preload("Project").Preload("Asset").Preload("Reporter").Preload("Assignee")
	if projectID != nil && *projectID != 0 {
		q = q.Where("project_id = ?", *projectID)
	}
	var vulns []models.Vulnerability
	if err := q.Order("severity DESC, created_at DESC").Find(&vulns).Error; err != nil {
		return nil, "", errors.New("查询漏洞数据失败")
	}

	stdName := standardName(standard)
	var b bytes.Buffer
	b.WriteString("# 合规性漏洞扫描与整改报告\n\n")
	b.WriteString(fmt.Sprintf("- 标准：%s\n", stdName))
	b.WriteString(fmt.Sprintf("- 导出时间：%s\n", time.Now().Format("2006-01-02 15:04:05")))
	if projectID != nil {
		b.WriteString(fmt.Sprintf("- 项目ID：%d\n", *projectID))
	}
	b.WriteString("\n## 漏洞清单\n\n")
	b.WriteString("|ID|标题|类型|严重程度|状态|资产|修复建议|\n|---|---|---|---|---|---|---|\n")
	for _, v := range vulns {
		b.WriteString(fmt.Sprintf("|%d|%s|%s|%s|%s|%s|%s|\n", v.ID, sanitize(v.Title), sanitize(v.VulnType), sanitize(v.Severity), sanitize(v.Status), sanitize(v.Asset.Name), sanitize(truncate(v.FixSuggestion, 60))))
	}
	b.WriteString("\n## 合规映射\n\n")
	b.WriteString(complianceMatrix(standard))
	return b.Bytes(), stdName, nil
}

func standardName(v string) string {
	switch v {
	case "mlps2":
		return "等保2.0"
	case "iso27001":
		return "ISO 27001"
	case "finance":
		return "金融行业规范"
	default:
		return "通用安全基线"
	}
}

func complianceMatrix(v string) string {
	switch v {
	case "mlps2":
		return "- 对应控制项：安全计算环境、应用安全、数据完整性\n- 重点整改：高危漏洞闭环、日志留存、最小权限\n"
	case "iso27001":
		return "- 对应控制项：A.8 资产管理、A.12 运行安全、A.14 系统开发安全\n- 重点整改：漏洞管理流程、修复SLA、变更记录\n"
	case "finance":
		return "- 对应控制项：重要信息系统漏洞管理、渗透测试、应急处置\n- 重点整改：高危漏洞时效、复测、审计追溯\n"
	default:
		return "- 对应控制项：漏洞发现-修复-复测-归档闭环\n"
	}
}

func sanitize(v string) string {
	return truncate(v, 120)
}

func truncate(v string, l int) string {
	r := []rune(v)
	if len(r) <= l {
		return v
	}
	return string(r[:l]) + "..."
}
