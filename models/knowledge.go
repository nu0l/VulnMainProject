package models

import "time"

// SecurityKnowledge 安全知识库条目
// 用于沉淀漏洞通用修复方案、排查思路和参考资料
type SecurityKnowledge struct {
	ID             uint       `gorm:"primary_key" json:"id"`
	Title          string     `gorm:"size:255;not null" json:"title"`
	VulnType       string     `gorm:"size:100;index" json:"vuln_type"`
	Severity       string     `gorm:"size:20" json:"severity"`
	Description    string     `gorm:"type:text" json:"description"`
	FixStrategy    string     `gorm:"type:text;not null" json:"fix_strategy"`
	ReferenceLinks string     `gorm:"type:text" json:"reference_links"`
	Tags           string     `gorm:"size:500" json:"tags"`
	UsageCount     int        `gorm:"default:0" json:"usage_count"`
	Status         int        `gorm:"default:1" json:"status"` // 1启用,0禁用
	CreatedBy      uint       `json:"created_by"`
	Creator        User       `gorm:"foreignkey:CreatedBy" json:"creator"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	DeletedAt      *time.Time `sql:"index" json:"deleted_at"`
}

func (SecurityKnowledge) TableName() string {
	return "security_knowledge"
}
