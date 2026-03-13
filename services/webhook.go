package services

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
	Init "vulnmain/Init"
)

type WebhookEndpoint struct {
	Name    string `json:"name"`
	Type    string `json:"type"`
	URL     string `json:"url"`
	Secret  string `json:"secret"`
	Enabled bool   `json:"enabled"`
}

type WebhookMessage struct {
	Event     string                 `json:"event"`
	EventName string                 `json:"event_name"`
	Timestamp string                 `json:"timestamp"`
	Source    string                 `json:"source"`
	Data      map[string]interface{} `json:"data"`
}

type WebhookService struct{}

var webhookService = &WebhookService{}

func (s *WebhookService) Notify(event string, data map[string]interface{}) {
	endpoints, enabled, events, timeout := s.loadConfig()
	if !enabled {
		return
	}

	if len(events) > 0 {
		if _, ok := events[event]; !ok {
			return
		}
	}

	message := WebhookMessage{
		Event:     event,
		EventName: eventLabel(event),
		Timestamp: time.Now().Format(time.RFC3339),
		Source:    "VulnMain",
		Data:      data,
	}

	for _, endpoint := range endpoints {
		if !endpoint.Enabled || strings.TrimSpace(endpoint.URL) == "" {
			continue
		}
		go s.send(endpoint, message, timeout)
	}
}

func (s *WebhookService) loadConfig() ([]WebhookEndpoint, bool, map[string]struct{}, int) {
	db := Init.GetDB()
	timeoutSeconds := 8
	enabled := false
	eventSet := map[string]struct{}{}
	endpoints := []WebhookEndpoint{}

	fetch := func(key string) string {
		var value string
		db.Table("system_configs").Select("value").Where("`key` = ?", key).Scan(&value)
		return value
	}

	enabled = fetch("webhook.enabled") == "true"

	timeoutRaw := fetch("webhook.timeout_seconds")
	if timeoutRaw != "" {
		if v, err := strconv.Atoi(timeoutRaw); err == nil && v > 0 {
			timeoutSeconds = v
		}
	}

	eventsRaw := fetch("webhook.events")
	for _, event := range strings.Split(eventsRaw, ",") {
		event = strings.TrimSpace(event)
		if event != "" {
			eventSet[event] = struct{}{}
		}
	}

	endpointsRaw := fetch("webhook.endpoints")
	if endpointsRaw != "" {
		_ = json.Unmarshal([]byte(endpointsRaw), &endpoints)
	}

	return endpoints, enabled, eventSet, timeoutSeconds
}

func (s *WebhookService) send(endpoint WebhookEndpoint, message WebhookMessage, timeoutSeconds int) {
	client := &http.Client{Timeout: time.Duration(timeoutSeconds) * time.Second}

	bodyBytes, contentType := buildWebhookBody(endpoint, message)
	req, err := http.NewRequest(http.MethodPost, endpoint.URL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		fmt.Printf("Webhook请求创建失败[%s]: %v\n", endpoint.Name, err)
		return
	}
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("X-VulnMain-Event", message.Event)

	if endpoint.Secret != "" {
		req.Header.Set("X-VulnMain-Signature", signPayload(bodyBytes, endpoint.Secret))
	}

	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Webhook发送失败[%s]: %v\n", endpoint.Name, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		fmt.Printf("Webhook返回异常[%s]: %d\n", endpoint.Name, resp.StatusCode)
	}
}

func buildWebhookBody(endpoint WebhookEndpoint, msg WebhookMessage) ([]byte, string) {
	endpointType := strings.ToLower(strings.TrimSpace(endpoint.Type))
	summary := fmt.Sprintf("[%s] %s", msg.EventName, msg.Timestamp)

	switch endpointType {
	case "dingtalk":
		payload := map[string]interface{}{
			"msgtype": "markdown",
			"markdown": map[string]string{
				"title": summary,
				"text":  fmt.Sprintf("### %s\n\n事件：`%s`\n\n详情：`%v`", msg.EventName, msg.Event, msg.Data),
			},
		}
		b, _ := json.Marshal(payload)
		return b, "application/json"
	case "feishu":
		payload := map[string]interface{}{
			"msg_type": "text",
			"content": map[string]string{
				"text": fmt.Sprintf("%s\n事件:%s\n详情:%v", msg.EventName, msg.Event, msg.Data),
			},
		}
		b, _ := json.Marshal(payload)
		return b, "application/json"
	default:
		b, _ := json.Marshal(msg)
		return b, "application/json"
	}
}

func signPayload(payload []byte, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(payload)
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}

func eventLabel(event string) string {
	labels := map[string]string{
		"vuln_detected":          "漏洞检出预警",
		"ticket_timeout":         "工单处理超时",
		"vuln_fix_failed":        "漏洞修复失败",
		"vuln_status_changed":    "漏洞状态变更",
		"vuln_deadline_reminder": "漏洞截止提醒",
	}
	if label, ok := labels[event]; ok {
		return label
	}
	return event
}
