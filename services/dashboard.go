package services

import (
	"time"
	Init "vulnmain/Init"
	"vulnmain/models"

	"github.com/jinzhu/gorm"
)

type DashboardService struct{}

// DashboardData 仪表板数据结构
type DashboardData struct {
	// 基础统计
	TotalVulns    int64 `json:"total_vulns"`    // 总漏洞数
	TotalProjects int64 `json:"total_projects"` // 总项目数
	TotalAssets   int64 `json:"total_assets"`   // 总资产数
	DueSoonVulns  int64 `json:"due_soon_vulns"` // 即将到期漏洞数

	// 漏洞状态统计
	VulnStatusStats map[string]int64 `json:"vuln_status_stats"`

	// 严重程度统计
	SeverityStats map[string]int64 `json:"severity_stats"`

	// 资产类型统计
	AssetTypeStats map[string]int64 `json:"asset_type_stats"`

	// 趋势数据（最近7天）
	TrendData []TrendDataItem `json:"trend_data"`

	// 排行榜
	SecurityEngineerRanking []EngineerRankingItem `json:"security_engineer_ranking,omitempty"`
	DevEngineerRanking      []EngineerRankingItem `json:"dev_engineer_ranking,omitempty"`

	// 最新漏洞
	LatestVulns []VulnListItem `json:"latest_vulns"`

	// 当前用户特定数据（仅安全工程师和研发工程师）
	CurrentUserVulns *UserVulnStats `json:"current_user_vulns,omitempty"`
}

// TrendDataItem 趋势数据项
type TrendDataItem struct {
	Date         string `json:"date"`
	NewVulns     int64  `json:"new_vulns"`
	FixedVulns   int64  `json:"fixed_vulns"`
	PendingVulns int64  `json:"pending_vulns"`
}

// EngineerRankingItem 工程师排行榜项
type EngineerRankingItem struct {
	UserID   uint   `json:"user_id"`
	Username string `json:"username"`
	RealName string `json:"real_name"`
	Count    int64  `json:"count"`
}

// VulnListItem 漏洞列表项
type VulnListItem struct {
	ID           uint       `json:"id"`
	Title        string     `json:"title"`
	Severity     string     `json:"severity"`
	Status       string     `json:"status"`
	ProjectName  string     `json:"project_name"`
	ReporterName string     `json:"reporter_name"`
	SubmittedAt  time.Time  `json:"submitted_at"`
	FixDeadline  *time.Time `json:"fix_deadline,omitempty"`
}

// UserVulnStats 用户漏洞统计
type UserVulnStats struct {
	TotalCount   int64            `json:"total_count"`   // 所有历史漏洞总数
	MonthlyCount int64            `json:"monthly_count"` // 当月提交漏洞数
	StatusStats  map[string]int64 `json:"status_stats"`
	DueSoonCount int64            `json:"due_soon_count"`
}

// GetDashboardData 获取仪表板数据
func (s *DashboardService) GetDashboardData(userID uint, roleCode string) (*DashboardData, error) {
	db := Init.GetDB()

	switch roleCode {
	case "super_admin", "leader":
		return s.getSuperAdminDashboard(db)
	case "security_engineer":
		return s.getSecurityEngineerDashboard(db, userID)
	case "dev_engineer":
		return s.getDevEngineerDashboard(db, userID)
	default:
		return s.getDefaultDashboard(db)
	}
}

// getSuperAdminDashboard 获取超级管理员仪表板数据
func (s *DashboardService) getSuperAdminDashboard(db *gorm.DB) (*DashboardData, error) {
	data := &DashboardData{
		VulnStatusStats: make(map[string]int64),
		AssetTypeStats:  make(map[string]int64),
	}

	// 总漏洞数
	db.Model(&models.Vulnerability{}).Count(&data.TotalVulns)

	// 总项目数
	db.Model(&models.Project{}).Where("status != ?", "archived").Count(&data.TotalProjects)

	// 总资产数
	db.Model(&models.Asset{}).Count(&data.TotalAssets)

	// 即将到期漏洞数（7天内）
	sevenDaysLater := time.Now().AddDate(0, 0, 7)
	db.Model(&models.Vulnerability{}).
		Where("fix_deadline IS NOT NULL AND fix_deadline <= ? AND status NOT IN ('fixed', 'completed', 'ignored')", sevenDaysLater).
		Count(&data.DueSoonVulns)

	// 漏洞状态统计
	var statusStats []struct {
		Status string `json:"status"`
		Count  int64  `json:"count"`
	}
	db.Model(&models.Vulnerability{}).
		Select("status, COUNT(*) as count").
		Group("status").
		Scan(&statusStats)

	for _, stat := range statusStats {
		data.VulnStatusStats[stat.Status] = stat.Count
	}

	// 安全工程师排行榜（当月提交漏洞数）
	currentMonth := time.Now().Format("2006-01")
	var secRanking []EngineerRankingItem
	db.Table("vulnerabilities").
		Select("users.id as user_id, users.username, users.real_name, COUNT(*) as count").
		Joins("JOIN users ON vulnerabilities.reporter_id = users.id").
		Where("vulnerabilities.submitted_at >= ? AND vulnerabilities.submitted_at < ?",
			currentMonth+"-01", getNextMonthStart(currentMonth)).
		Group("users.id").
		Order("count DESC").
		Limit(10).
		Scan(&secRanking)
	data.SecurityEngineerRanking = secRanking

	// 研发工程师排行榜（当月修复完成漏洞数）
	var devRanking []EngineerRankingItem

	// 首先尝试基于 fixed_by 和 fixed_at 的查询（标准流程）
	db.Table("vulnerabilities").
		Select("users.id as user_id, users.username, users.real_name, COUNT(*) as count").
		Joins("JOIN users ON vulnerabilities.fixed_by = users.id").
		Where("vulnerabilities.fixed_at >= ? AND vulnerabilities.fixed_at < ? AND vulnerabilities.fixed_by IS NOT NULL",
			currentMonth+"-01", getNextMonthStart(currentMonth)).
		Group("users.id").
		Order("count DESC").
		Limit(10).
		Scan(&devRanking)

	// 如果基于 fixed_by 的查询没有结果，使用 assignee_id 和状态的查询（兼容性查询）
	if len(devRanking) == 0 {
		db.Table("vulnerabilities").
			Select("users.id as user_id, users.username, users.real_name, COUNT(*) as count").
			Joins("JOIN users ON vulnerabilities.assignee_id = users.id").
			Where("vulnerabilities.status IN ('fixed', 'closed', 'completed') AND vulnerabilities.updated_at >= ? AND vulnerabilities.updated_at < ? AND vulnerabilities.assignee_id IS NOT NULL",
				currentMonth+"-01", getNextMonthStart(currentMonth)).
			Group("users.id").
			Order("count DESC").
			Limit(10).
			Scan(&devRanking)
	}

	data.DevEngineerRanking = devRanking

	// 最新漏洞（前10）
	var latestVulns []VulnListItem
	db.Table("vulnerabilities").
		Select("vulnerabilities.id, vulnerabilities.title, vulnerabilities.severity, vulnerabilities.status, vulnerabilities.submitted_at, vulnerabilities.fix_deadline, projects.name as project_name, users.real_name as reporter_name").
		Joins("LEFT JOIN projects ON vulnerabilities.project_id = projects.id").
		Joins("LEFT JOIN users ON vulnerabilities.reporter_id = users.id").
		Order("vulnerabilities.submitted_at DESC").
		Limit(10).
		Scan(&latestVulns)
	data.LatestVulns = latestVulns

	var superAssetTypeStats []struct {
		Type  string
		Count int64
	}
	db.Model(&models.Asset{}).Select("type, COUNT(*) as count").Group("type").Scan(&superAssetTypeStats)
	for _, stat := range superAssetTypeStats {
		data.AssetTypeStats[stat.Type] = stat.Count
	}

	return data, nil
}

// getSecurityEngineerDashboard 获取安全工程师仪表板数据
func (s *DashboardService) getSecurityEngineerDashboard(db *gorm.DB, userID uint) (*DashboardData, error) {
	data := &DashboardData{
		VulnStatusStats: make(map[string]int64),
		AssetTypeStats:  make(map[string]int64),
		CurrentUserVulns: &UserVulnStats{
			StatusStats: make(map[string]int64),
		},
	}

	// 当前用户所有提交的漏洞数（用于修复率计算）
	db.Model(&models.Vulnerability{}).
		Where("reporter_id = ?", userID).
		Count(&data.CurrentUserVulns.TotalCount)

	// 当前用户当月提交的漏洞数
	currentMonth := time.Now().Format("2006-01")
	db.Model(&models.Vulnerability{}).
		Where("reporter_id = ? AND submitted_at >= ? AND submitted_at < ?",
			userID, currentMonth+"-01", getNextMonthStart(currentMonth)).
		Count(&data.CurrentUserVulns.MonthlyCount)

	// 当前用户漏洞状态统计
	var userStatusStats []struct {
		Status string `json:"status"`
		Count  int64  `json:"count"`
	}
	db.Model(&models.Vulnerability{}).
		Select("status, COUNT(*) as count").
		Where("reporter_id = ?", userID).
		Group("status").
		Scan(&userStatusStats)

	for _, stat := range userStatusStats {
		data.CurrentUserVulns.StatusStats[stat.Status] = stat.Count
	}

	// 当前用户即将到期漏洞数
	sevenDaysLater := time.Now().AddDate(0, 0, 7)
	db.Model(&models.Vulnerability{}).
		Where("reporter_id = ? AND fix_deadline IS NOT NULL AND fix_deadline <= ? AND status NOT IN ('fixed', 'completed', 'ignored')",
			userID, sevenDaysLater).
		Count(&data.CurrentUserVulns.DueSoonCount)

	// 安全工程师排行榜
	var secRanking []EngineerRankingItem
	db.Table("vulnerabilities").
		Select("users.id as user_id, users.username, users.real_name, COUNT(*) as count").
		Joins("JOIN users ON vulnerabilities.reporter_id = users.id").
		Where("vulnerabilities.submitted_at >= ? AND vulnerabilities.submitted_at < ?",
			currentMonth+"-01", getNextMonthStart(currentMonth)).
		Group("users.id").
		Order("count DESC").
		Limit(10).
		Scan(&secRanking)
	data.SecurityEngineerRanking = secRanking

	// 获取当前用户参与的项目（任何角色）
	var projectIDs []uint
	db.Table("project_members").
		Select("project_id").
		Where("user_id = ?", userID).
		Pluck("project_id", &projectIDs)

	// 当前用户相关的最新漏洞
	var latestVulns []VulnListItem
	query := db.Table("vulnerabilities").
		Select("vulnerabilities.id, vulnerabilities.title, vulnerabilities.severity, vulnerabilities.status, vulnerabilities.submitted_at, vulnerabilities.fix_deadline, projects.name as project_name, users.real_name as reporter_name").
		Joins("LEFT JOIN projects ON vulnerabilities.project_id = projects.id").
		Joins("LEFT JOIN users ON vulnerabilities.reporter_id = users.id")

	// 显示用户相关的漏洞：参与的项目漏洞、自己提交的漏洞，如果都没有则显示所有最新漏洞
	if len(projectIDs) > 0 {
		query = query.Where("vulnerabilities.project_id IN (?) OR vulnerabilities.reporter_id = ?", projectIDs, userID)
	} else {
		// 如果用户没有参与任何项目，先尝试显示自己提交的漏洞
		var userVulnCount int64
		db.Model(&models.Vulnerability{}).Where("reporter_id = ?", userID).Count(&userVulnCount)
		if userVulnCount > 0 {
			query = query.Where("vulnerabilities.reporter_id = ?", userID)
		} else {
			// 如果用户没有提交过漏洞，显示所有最新漏洞
			// 不添加额外的WHERE条件，显示全部漏洞
		}
	}

	query.Order("vulnerabilities.submitted_at DESC").
		Limit(10).
		Scan(&latestVulns)
	data.LatestVulns = latestVulns

	if len(projectIDs) > 0 {
		db.Model(&models.Asset{}).Where("created_by = ? OR project_id IN (?)", userID, projectIDs).Count(&data.TotalAssets)
		var secAssetTypeStats []struct {
			Type  string
			Count int64
		}
		db.Model(&models.Asset{}).Select("type, COUNT(*) as count").Where("created_by = ? OR project_id IN (?)", userID, projectIDs).Group("type").Scan(&secAssetTypeStats)
		for _, stat := range secAssetTypeStats {
			data.AssetTypeStats[stat.Type] = stat.Count
		}
	} else {
		db.Model(&models.Asset{}).Where("created_by = ?", userID).Count(&data.TotalAssets)
		var secAssetTypeStats []struct {
			Type  string
			Count int64
		}
		db.Model(&models.Asset{}).Select("type, COUNT(*) as count").Where("created_by = ?", userID).Group("type").Scan(&secAssetTypeStats)
		for _, stat := range secAssetTypeStats {
			data.AssetTypeStats[stat.Type] = stat.Count
		}
	}

	return data, nil
}

// getDevEngineerDashboard 获取研发工程师仪表板数据
func (s *DashboardService) getDevEngineerDashboard(db *gorm.DB, userID uint) (*DashboardData, error) {
	data := &DashboardData{
		VulnStatusStats: make(map[string]int64),
		AssetTypeStats:  make(map[string]int64),
		CurrentUserVulns: &UserVulnStats{
			StatusStats: make(map[string]int64),
		},
	}

	// 当前用户名下的漏洞数量
	db.Model(&models.Vulnerability{}).
		Where("assignee_id = ?", userID).
		Count(&data.CurrentUserVulns.TotalCount)

	// 当前用户漏洞状态统计
	var userStatusStats []struct {
		Status string `json:"status"`
		Count  int64  `json:"count"`
	}
	db.Model(&models.Vulnerability{}).
		Select("status, COUNT(*) as count").
		Where("assignee_id = ?", userID).
		Group("status").
		Scan(&userStatusStats)

	for _, stat := range userStatusStats {
		data.CurrentUserVulns.StatusStats[stat.Status] = stat.Count
	}

	// 当前用户即将到期漏洞数
	sevenDaysLater := time.Now().AddDate(0, 0, 7)
	db.Model(&models.Vulnerability{}).
		Where("assignee_id = ? AND fix_deadline IS NOT NULL AND fix_deadline <= ? AND status NOT IN ('fixed', 'completed', 'ignored')",
			userID, sevenDaysLater).
		Count(&data.CurrentUserVulns.DueSoonCount)

	// 研发工程师排行榜（当月修复完成漏洞数）
	currentMonth := time.Now().Format("2006-01")
	var devRanking []EngineerRankingItem

	// 首先尝试基于 fixed_by 和 fixed_at 的查询（标准流程）
	db.Table("vulnerabilities").
		Select("users.id as user_id, users.username, users.real_name, COUNT(*) as count").
		Joins("JOIN users ON vulnerabilities.fixed_by = users.id").
		Where("vulnerabilities.fixed_at >= ? AND vulnerabilities.fixed_at < ? AND vulnerabilities.fixed_by IS NOT NULL",
			currentMonth+"-01", getNextMonthStart(currentMonth)).
		Group("users.id").
		Order("count DESC").
		Limit(10).
		Scan(&devRanking)

	// 如果基于 fixed_by 的查询没有结果，使用 assignee_id 和状态的查询（兼容性查询）
	if len(devRanking) == 0 {
		db.Table("vulnerabilities").
			Select("users.id as user_id, users.username, users.real_name, COUNT(*) as count").
			Joins("JOIN users ON vulnerabilities.assignee_id = users.id").
			Where("vulnerabilities.status IN ('fixed', 'closed', 'completed') AND vulnerabilities.updated_at >= ? AND vulnerabilities.updated_at < ? AND vulnerabilities.assignee_id IS NOT NULL",
				currentMonth+"-01", getNextMonthStart(currentMonth)).
			Group("users.id").
			Order("count DESC").
			Limit(10).
			Scan(&devRanking)
	}

	data.DevEngineerRanking = devRanking

	// 获取当前用户参与的项目（任何角色）
	var projectIDs []uint
	db.Table("project_members").
		Select("project_id").
		Where("user_id = ?", userID).
		Pluck("project_id", &projectIDs)

	// 当前用户相关的最新漏洞
	var latestVulns []VulnListItem
	query := db.Table("vulnerabilities").
		Select("vulnerabilities.id, vulnerabilities.title, vulnerabilities.severity, vulnerabilities.status, vulnerabilities.submitted_at, vulnerabilities.fix_deadline, projects.name as project_name, users.real_name as reporter_name").
		Joins("LEFT JOIN projects ON vulnerabilities.project_id = projects.id").
		Joins("LEFT JOIN users ON vulnerabilities.reporter_id = users.id")

	// 显示用户相关的漏洞：参与的项目漏洞、分配给自己的漏洞，如果都没有则显示所有最新漏洞
	if len(projectIDs) > 0 {
		query = query.Where("vulnerabilities.project_id IN (?) OR vulnerabilities.assignee_id = ?", projectIDs, userID)
	} else {
		// 如果用户没有参与任何项目，先尝试显示分配给自己的漏洞
		var assignedVulnCount int64
		db.Model(&models.Vulnerability{}).Where("assignee_id = ?", userID).Count(&assignedVulnCount)
		if assignedVulnCount > 0 {
			query = query.Where("vulnerabilities.assignee_id = ?", userID)
		} else {
			// 如果用户没有分配的漏洞，显示所有最新漏洞
			// 不添加额外的WHERE条件，显示全部漏洞
		}
	}

	query.Order("vulnerabilities.submitted_at DESC").
		Limit(10).
		Scan(&latestVulns)
	data.LatestVulns = latestVulns

	if len(projectIDs) > 0 {
		db.Model(&models.Asset{}).Where("project_id IN (?)", projectIDs).Count(&data.TotalAssets)
		var devAssetTypeStats []struct {
			Type  string
			Count int64
		}
		db.Model(&models.Asset{}).Select("type, COUNT(*) as count").Where("project_id IN (?)", projectIDs).Group("type").Scan(&devAssetTypeStats)
		for _, stat := range devAssetTypeStats {
			data.AssetTypeStats[stat.Type] = stat.Count
		}
	}

	return data, nil
}

// getDefaultDashboard 获取默认仪表板数据（普通用户）
func (s *DashboardService) getDefaultDashboard(db *gorm.DB) (*DashboardData, error) {
	data := &DashboardData{
		VulnStatusStats: make(map[string]int64),
		AssetTypeStats:  make(map[string]int64),
		LatestVulns:     []VulnListItem{},
	}
	return data, nil
}

// getNextMonthStart 获取下个月开始时间
func getNextMonthStart(currentMonth string) string {
	t, _ := time.Parse("2006-01", currentMonth)
	nextMonth := t.AddDate(0, 1, 0)
	return nextMonth.Format("2006-01-02")
}
