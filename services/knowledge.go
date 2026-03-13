package services

import (
	"errors"

	"github.com/jinzhu/gorm"
	"strings"
	Init "vulnmain/Init"
	"vulnmain/models"
)

type KnowledgeService struct{}

type KnowledgeCreateRequest struct {
	Title          string `json:"title" binding:"required"`
	VulnType       string `json:"vuln_type" binding:"required"`
	Severity       string `json:"severity"`
	Description    string `json:"description"`
	FixStrategy    string `json:"fix_strategy" binding:"required"`
	ReferenceLinks string `json:"reference_links"`
	Tags           string `json:"tags"`
	Status         *int   `json:"status"`
}

type KnowledgeUpdateRequest struct {
	Title          string `json:"title"`
	VulnType       string `json:"vuln_type"`
	Severity       string `json:"severity"`
	Description    string `json:"description"`
	FixStrategy    string `json:"fix_strategy"`
	ReferenceLinks string `json:"reference_links"`
	Tags           string `json:"tags"`
	Status         *int   `json:"status"`
}

func (s *KnowledgeService) Create(req *KnowledgeCreateRequest, userID uint) (*models.SecurityKnowledge, error) {
	db := Init.GetDB()
	item := models.SecurityKnowledge{
		Title:          strings.TrimSpace(req.Title),
		VulnType:       strings.TrimSpace(req.VulnType),
		Severity:       strings.TrimSpace(req.Severity),
		Description:    strings.TrimSpace(req.Description),
		FixStrategy:    strings.TrimSpace(req.FixStrategy),
		ReferenceLinks: strings.TrimSpace(req.ReferenceLinks),
		Tags:           strings.TrimSpace(req.Tags),
		Status:         1,
		CreatedBy:      userID,
	}
	if req.Status != nil {
		item.Status = *req.Status
	}
	if err := db.Create(&item).Error; err != nil {
		return nil, errors.New("创建知识条目失败")
	}
	db.Preload("Creator").First(&item, item.ID)
	return &item, nil
}

func (s *KnowledgeService) Update(id uint, req *KnowledgeUpdateRequest) (*models.SecurityKnowledge, error) {
	db := Init.GetDB()
	var item models.SecurityKnowledge
	if err := db.First(&item, id).Error; err != nil {
		return nil, errors.New("知识条目不存在")
	}
	if req.Title != "" {
		item.Title = strings.TrimSpace(req.Title)
	}
	if req.VulnType != "" {
		item.VulnType = strings.TrimSpace(req.VulnType)
	}
	if req.Severity != "" {
		item.Severity = strings.TrimSpace(req.Severity)
	}
	if req.Description != "" {
		item.Description = strings.TrimSpace(req.Description)
	}
	if req.FixStrategy != "" {
		item.FixStrategy = strings.TrimSpace(req.FixStrategy)
	}
	if req.ReferenceLinks != "" {
		item.ReferenceLinks = strings.TrimSpace(req.ReferenceLinks)
	}
	if req.Tags != "" {
		item.Tags = strings.TrimSpace(req.Tags)
	}
	if req.Status != nil {
		item.Status = *req.Status
	}
	if err := db.Save(&item).Error; err != nil {
		return nil, errors.New("更新知识条目失败")
	}
	db.Preload("Creator").First(&item, item.ID)
	return &item, nil
}

func (s *KnowledgeService) Delete(id uint) error {
	db := Init.GetDB()
	var item models.SecurityKnowledge
	if err := db.First(&item, id).Error; err != nil {
		return errors.New("知识条目不存在")
	}
	return db.Delete(&item).Error
}

func (s *KnowledgeService) List(keyword, vulnType string, page, pageSize int) ([]models.SecurityKnowledge, int64, error) {
	db := Init.GetDB()
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 10
	}
	q := db.Model(&models.SecurityKnowledge{}).Preload("Creator")
	if keyword != "" {
		like := "%" + keyword + "%"
		q = q.Where("title LIKE ? OR description LIKE ? OR fix_strategy LIKE ? OR tags LIKE ?", like, like, like, like)
	}
	if vulnType != "" {
		q = q.Where("vuln_type = ?", vulnType)
	}
	var total int64
	q.Count(&total)
	var items []models.SecurityKnowledge
	if err := q.Order("usage_count DESC, updated_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&items).Error; err != nil {
		return nil, 0, errors.New("查询知识库失败")
	}
	return items, total, nil
}

func (s *KnowledgeService) RecommendByVuln(vulnType, severity string, limit int) ([]models.SecurityKnowledge, error) {
	db := Init.GetDB()
	if limit <= 0 {
		limit = 5
	}
	var items []models.SecurityKnowledge
	q := db.Where("status = 1")
	if vulnType != "" {
		q = q.Where("vuln_type = ?", vulnType)
	}
	if severity != "" {
		q = q.Where("severity = ? OR severity = ''", severity)
	}
	if err := q.Order("usage_count DESC, updated_at DESC").Limit(limit).Find(&items).Error; err != nil {
		return nil, errors.New("获取推荐修复策略失败")
	}
	return items, nil
}

func (s *KnowledgeService) IncreaseUsage(ids []uint) {
	if len(ids) == 0 {
		return
	}
	db := Init.GetDB()
	db.Model(&models.SecurityKnowledge{}).Where("id IN (?)", ids).UpdateColumn("usage_count", gorm.Expr("usage_count + ?", 1))
}
