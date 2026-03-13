package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jinzhu/gorm"
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

type AlertItem struct {
	Title     string `json:"title"`
	Severity  string `json:"severity"`
	Source    string `json:"source"`
	PublishAt string `json:"publish_at"`
	Link      string `json:"link"`
	Summary   string `json:"summary"`
}

type AlertListResponse struct {
	Items      []AlertItem `json:"items"`
	Total      int         `json:"total"`
	Page       int         `json:"page"`
	PageSize   int         `json:"page_size"`
	TotalPages int         `json:"total_pages"`
}

func (s *KnowledgeService) ListAlerts(page, pageSize int) (*AlertListResponse, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 10
	}
	if pageSize > 100 {
		pageSize = 100
	}

	db := Init.GetDB()
	var cfg models.SystemConfig
	if err := db.Where("`key` = ?", "knowledge.alert_feeds").First(&cfg).Error; err != nil {
		return &AlertListResponse{Items: []AlertItem{}, Total: 0, Page: page, PageSize: pageSize, TotalPages: 0}, nil
	}

	var items []AlertItem
	if strings.TrimSpace(cfg.Value) != "" {
		if err := json.Unmarshal([]byte(cfg.Value), &items); err != nil {
			return nil, fmt.Errorf("漏洞预警订阅配置格式错误: %v", err)
		}
	}

	for i := range items {
		if strings.TrimSpace(items[i].PublishAt) == "" {
			items[i].PublishAt = time.Now().Format(time.RFC3339)
		}
		if strings.TrimSpace(items[i].Severity) == "" {
			items[i].Severity = "medium"
		}
	}

	total := len(items)
	if total == 0 {
		return &AlertListResponse{Items: []AlertItem{}, Total: 0, Page: page, PageSize: pageSize, TotalPages: 0}, nil
	}

	offset := (page - 1) * pageSize
	if offset >= total {
		return &AlertListResponse{Items: []AlertItem{}, Total: total, Page: page, PageSize: pageSize, TotalPages: (total + pageSize - 1) / pageSize}, nil
	}
	end := offset + pageSize
	if end > total {
		end = total
	}

	return &AlertListResponse{
		Items:      items[offset:end],
		Total:      total,
		Page:       page,
		PageSize:   pageSize,
		TotalPages: (total + pageSize - 1) / pageSize,
	}, nil
}
