package api

import (
	"net/http"
	"strconv"
	"vulnmain/services"

	"github.com/gin-gonic/gin"
)

var knowledgeService = &services.KnowledgeService{}

func CreateKnowledge(c *gin.Context) {
	var req services.KnowledgeCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误: " + err.Error()})
		return
	}
	userID, _ := c.Get("user_id")
	item, err := knowledgeService.Create(&req, userID.(uint))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 200, "msg": "创建成功", "data": item})
}

func UpdateKnowledge(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	var req services.KnowledgeUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": "参数错误: " + err.Error()})
		return
	}
	item, err := knowledgeService.Update(uint(id), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 200, "msg": "更新成功", "data": item})
}

func DeleteKnowledge(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	if err := knowledgeService.Delete(uint(id)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": 400, "msg": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 200, "msg": "删除成功"})
}

func GetKnowledgeList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	keyword := c.Query("keyword")
	vulnType := c.Query("vuln_type")
	items, total, err := knowledgeService.List(keyword, vulnType, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 200, "msg": "获取成功", "data": gin.H{"items": items, "total": total, "page": page, "page_size": pageSize}})
}

func RecommendKnowledge(c *gin.Context) {
	vulnType := c.Query("vuln_type")
	severity := c.Query("severity")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "5"))
	items, err := knowledgeService.RecommendByVuln(vulnType, severity, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 200, "msg": "获取成功", "data": items})
}

func GetKnowledgeAlerts(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	data, err := knowledgeService.ListAlerts(page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": 500, "msg": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 200, "msg": "获取成功", "data": data})
}
