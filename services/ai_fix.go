package services

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
	Init "vulnmain/Init"
	"vulnmain/models"
)

type AIFixService struct{}

type aiGenerateRequest struct {
	Prompt string `json:"prompt"`
}

type aiGenerateResponse struct {
	Content string `json:"content"`
}

func (s *AIFixService) GenerateSuggestion(vulnID uint) (string, error) {
	db := Init.GetDB()
	var vuln models.Vulnerability
	if err := db.Preload("Asset").Preload("Project").First(&vuln, vulnID).Error; err != nil {
		return "", errors.New("漏洞不存在")
	}

	mode, endpoint, token := s.loadConfig()
	prompt := buildPrompt(&vuln)

	if mode == "remote" && endpoint != "" {
		if content, err := s.callRemote(endpoint, token, prompt); err == nil && strings.TrimSpace(content) != "" {
			return content, nil
		}
	}

	return buildFallbackMarkdown(&vuln), nil
}

func (s *AIFixService) loadConfig() (mode, endpoint, token string) {
	db := Init.GetDB()
	get := func(key, dft string) string {
		var v string
		db.Table("system_configs").Select("value").Where("`key` = ?", key).Scan(&v)
		if strings.TrimSpace(v) == "" {
			return dft
		}
		return strings.TrimSpace(v)
	}
	return get("ai.mode", "local"), get("ai.remote.endpoint", ""), get("ai.remote.api_key", "")
}

func (s *AIFixService) callRemote(endpoint, token, prompt string) (string, error) {
	payload, _ := json.Marshal(aiGenerateRequest{Prompt: prompt})
	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewBuffer(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("remote llm status: %d", resp.StatusCode)
	}
	var out aiGenerateResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	return out.Content, nil
}

func buildPrompt(v *models.Vulnerability) string {
	return fmt.Sprintf("请基于以下漏洞信息生成可执行修复建议（Markdown格式，包含修复步骤、验证步骤、回归测试点）：\n标题:%s\n类型:%s\n严重程度:%s\nURL:%s\n描述:%s\n资产:%s\n项目:%s\n", v.Title, v.VulnType, v.Severity, v.VulnURL, v.Description, v.Asset.Name, v.Project.Name)
}

func buildFallbackMarkdown(v *models.Vulnerability) string {
	return fmt.Sprintf("## AI 修复建议（本地模式）\n\n### 漏洞概览\n- 标题：%s\n- 类型：%s\n- 严重程度：%s\n\n### 修复步骤\n1. 复现漏洞并确认输入点。\n2. 对相关输入实施白名单校验与上下文编码。\n3. 增加服务端权限校验与安全日志。\n4. 补充单元测试与集成测试覆盖攻击向量。\n\n### 验证步骤\n- 使用原PoC复测应失败。\n- 验证业务主流程不受影响。\n\n### 回归检查\n- 检查同类接口/页面是否存在相同模式问题。\n", v.Title, v.VulnType, v.Severity)
}
