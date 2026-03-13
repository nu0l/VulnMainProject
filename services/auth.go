// 认证服务包
// 该包提供用户登录、令牌刷新、登出等认证相关的业务逻辑处理
package services

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"            // 导入错误处理包
	"time"               // 导入时间包，用于处理登录时间
	Init "vulnmain/Init" // 导入初始化包，获取数据库连接
	"vulnmain/models"    // 导入模型包，使用用户和日志模型
	"vulnmain/utils"     // 导入工具包，使用JWT相关功能
)

// AuthService结构体定义认证服务
// 提供多种登录方式和认证相关的业务逻辑处理方法
type AuthService struct{}

// LoginRequest结构体定义用户登录请求参数
// 仅支持本地用户名密码登录
type LoginRequest struct {
	Username         string `json:"username" binding:"required"` // 用户名，必填字段
	Password         string `json:"password" binding:"required"` // 密码，必填字段
	SecondFactorCode string `json:"second_factor_code"`          // 二次验证码（TOTP/短信）
}

// LoginResponse结构体定义登录成功后的响应数据
// 包含JWT令牌、用户信息、权限列表等
type LoginResponse struct {
	Token        string       `json:"token"`         // JWT访问令牌
	RefreshToken string       `json:"refresh_token"` // 刷新令牌（暂未实现）
	User         *models.User `json:"user"`          // 用户基本信息
	Permissions  []string     `json:"permissions"`   // 用户权限代码列表
	ExpiresIn    int64        `json:"expires_in"`    // 令牌过期时间（秒）
}

// LocalLogin方法处理本地用户名密码登录
// 验证用户凭据，生成JWT令牌，更新登录时间，记录登录日志
// 参数：req - 登录请求参数
// 返回：登录响应数据和可能的错误
func (s *AuthService) LocalLogin(req *LoginRequest) (*LoginResponse, error) {
	// 获取数据库连接
	db := Init.GetDB()

	// 根据用户名或邮箱查找用户，同时预加载角色和权限信息
	var user models.User
	if err := db.Preload("Role.Permissions").Where("username = ? OR email = ?", req.Username, req.Username).First(&user).Error; err != nil {
		// 未找到用户：若启用LDAP，则尝试直接进行LDAP认证并按需创建占位用户
		ldapSvc := &LDAPService{}
		cfg, _ := ldapSvc.loadConfig()
		if cfg != nil && cfg.Enabled {
			ok, err2 := ldapSvc.Authenticate(req.Username, req.Password)
			if !ok || err2 != nil {
				return nil, errors.New("用户名或密码错误")
			}
			// 确保有用户记录（只需用户名 + 默认邮箱），默认角色normal_user
			var normalRole models.Role
			db.Where("code = ?", "normal_user").First(&normalRole)
			placeholder := models.User{Username: req.Username, Email: fmt.Sprintf("%s@ldap.local", req.Username), Status: 1, RoleID: normalRole.ID, Source: "ldap"}
			// 设置随机密码以满足非空约束
			_ = placeholder.SetPassword("ldap_placeholder")
			db.Where(models.User{Username: req.Username}).Attrs(placeholder).FirstOrCreate(&user)
			// 记录并继续签发token
			goto ISSUE_TOKEN
		}
		// 否则返回本地错误
		return nil, errors.New("用户名或密码错误")
	}

	// 检查用户账户状态是否为启用状态
	if user.Status != 1 {
		return nil, errors.New("用户已被禁用")
	}

	// 判断来源
	if user.Source == "ldap" {
		ldapSvc := &LDAPService{}
		ok, err := ldapSvc.Authenticate(user.Username, req.Password)
		if !ok || err != nil {
			// 记录登录失败日志
			s.LogLogin(&user, "failed", "LDAP密码错误")
			return nil, errors.New("用户名或密码错误")
		}
		// LDAP 验证通过
		s.LogLogin(&user, "success", "LDAP登录成功")
		goto ISSUE_TOKEN
	}

	// 本地账户：验证密码
	if !user.CheckPassword(req.Password) {
		// 记录登录失败日志
		s.LogLogin(&user, "failed", "密码错误")
		return nil, errors.New("用户名或密码错误")
	}

	s.LogLogin(&user, "success", "本地登录成功")

ISSUE_TOKEN:
	if err := s.verifySecondFactor(req.SecondFactorCode); err != nil {
		return nil, err
	}

	// 更新用户最后登录时间
	now := time.Now().Truncate(time.Second)
	user.LastLoginAt = &now
	db.Save(&user)

	// 为用户生成JWT访问令牌
	token, err := utils.GenerateToken(&user)
	if err != nil {
		return nil, errors.New("生成令牌失败")
	}

	// 提取用户权限代码列表，用于前端权限控制
	var permissions []string
	for _, perm := range user.Role.Permissions {
		permissions = append(permissions, perm.Code)
	}

	// 构建并返回登录响应数据
	return &LoginResponse{
		Token:       token,                                 // JWT访问令牌
		User:        &user,                                 // 用户信息
		Permissions: permissions,                           // 权限列表
		ExpiresIn:   int64(utils.GetJWTExpire().Seconds()), // 令牌过期时间（秒）
	}, nil
}

// Login 本地登录入口
func (s *AuthService) Login(req *LoginRequest) (*LoginResponse, error) {
	return s.LocalLogin(req)
}

// RefreshToken 刷新令牌
func (s *AuthService) RefreshToken(tokenString string) (*LoginResponse, error) {
	newToken, err := utils.RefreshToken(tokenString)
	if err != nil {
		return nil, err
	}

	// 解析新令牌获取用户信息
	claims, err := utils.ParseToken(newToken)
	if err != nil {
		return nil, err
	}

	db := Init.GetDB()
	var user models.User
	if err := db.Preload("Role.Permissions").Where("id = ?", claims.UserID).First(&user).Error; err != nil {
		return nil, errors.New("用户不存在")
	}

	// 提取权限代码
	var permissions []string
	for _, perm := range user.Role.Permissions {
		permissions = append(permissions, perm.Code)
	}

	return &LoginResponse{
		Token:       newToken,
		User:        &user,
		Permissions: permissions,
		ExpiresIn:   int64(utils.GetJWTExpire() * 3600),
	}, nil
}

// Logout 用户登出
func (s *AuthService) Logout(userID uint) error {
	// 这里可以实现令牌黑名单机制
	// 或者记录登出日志

	db := Init.GetDB()
	var user models.User
	if err := db.Where("id = ?", userID).First(&user).Error; err == nil {
		s.LogLogin(&user, "success", "用户登出")
	}

	return nil
}

// LogLogin 记录登录日志
func (s *AuthService) LogLogin(user *models.User, status, details string) {
	db := Init.GetDB()

	log := models.OperationLog{
		UserID:   user.ID,
		Module:   "auth",
		Action:   "login",
		Resource: user.Username,
		Details:  details,
		Status:   status,
	}

	db.Create(&log)
}

func (s *AuthService) verifySecondFactor(code string) error {
	db := Init.GetDB()
	get := func(key, dft string) string {
		var v string
		db.Table("system_configs").Select("value").Where("`key` = ?", key).Scan(&v)
		if strings.TrimSpace(v) == "" {
			return dft
		}
		return strings.TrimSpace(v)
	}
	if get("auth.mfa.enabled", "false") != "true" {
		return nil
	}
	if strings.TrimSpace(code) == "" {
		if get("auth.mfa.optional", "true") == "true" {
			return nil
		}
		return errors.New("请填写二次验证码")
	}
	method := get("auth.mfa.method", "totp")
	switch method {
	case "sms":
		if code != get("auth.mfa.sms_mock_code", "123456") {
			return errors.New("短信验证码错误")
		}
	default:
		secret := get("auth.mfa.totp_secret", "")
		if secret == "" || !validateTOTP(secret, code) {
			return errors.New("TOTP验证码错误")
		}
	}
	return nil
}

func validateTOTP(secret, code string) bool {
	counter := time.Now().Unix() / 30
	for _, offset := range []int64{-1, 0, 1} {
		if generateTOTP(secret, counter+offset) == code {
			return true
		}
	}
	return false
}

func generateTOTP(secret string, counter int64) string {
	secret = strings.ToUpper(strings.TrimSpace(secret))
	key, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(secret)
	if err != nil {
		return ""
	}
	var msg [8]byte
	binary.BigEndian.PutUint64(msg[:], uint64(counter))
	h := hmac.New(sha1.New, key)
	h.Write(msg[:])
	hash := h.Sum(nil)
	offset := hash[len(hash)-1] & 0x0f
	binCode := (int(hash[offset])&0x7f)<<24 | (int(hash[offset+1])&0xff)<<16 | (int(hash[offset+2])&0xff)<<8 | (int(hash[offset+3]) & 0xff)
	otp := binCode % 1000000
	return fmt.Sprintf("%06d", otp)
}

// QrLoginStartResponse 扫码登录启动响应
// 当前版本返回会话ID与二维码地址（可对接第三方扫码平台）
type QrLoginStartResponse struct {
	SessionID string `json:"session_id"`
	QRCodeURL string `json:"qrcode_url"`
	Provider  string `json:"provider"`
	ExpiresIn int64  `json:"expires_in"`
	Enabled   bool   `json:"enabled"`
}

// QrLoginCallbackRequest 扫码登录回调请求（后续可由第三方回调驱动）
type QrLoginCallbackRequest struct {
	SessionID      string `json:"session_id" binding:"required"`
	ProviderUserID string `json:"provider_user_id" binding:"required"`
	Username       string `json:"username"`
	Email          string `json:"email"`
	RealName       string `json:"real_name"`
	Department     string `json:"department"`
	Phone          string `json:"phone"`
}

func (s *AuthService) getSystemConfigValue(key, dft string) string {
	db := Init.GetDB()
	var v string
	db.Table("system_configs").Select("value").Where("`key` = ?", key).Scan(&v)
	if strings.TrimSpace(v) == "" {
		return dft
	}
	return strings.TrimSpace(v)
}

// StartQrLogin 启动扫码登录
func (s *AuthService) StartQrLogin() (*QrLoginStartResponse, error) {
	enabled := s.getSystemConfigValue("auth.qrcode.enabled", "false") == "true"
	provider := s.getSystemConfigValue("auth.qrcode.provider", "mock")
	apiURL := s.getSystemConfigValue("auth.qrcode.api_url", "")

	randomBytes := make([]byte, 8)
	_, _ = rand.Read(randomBytes)
	sessionID := hex.EncodeToString(randomBytes)

	qrURL := fmt.Sprintf("mock://qrcode-login/%s", sessionID)
	if strings.TrimSpace(apiURL) != "" {
		qrURL = fmt.Sprintf("%s/start?session_id=%s", strings.TrimRight(apiURL, "/"), sessionID)
	}

	return &QrLoginStartResponse{
		SessionID: sessionID,
		QRCodeURL: qrURL,
		Provider:  provider,
		ExpiresIn: 300,
		Enabled:   enabled,
	}, nil
}

// QrLoginCallback 处理扫码登录回调，并按配置自动导入用户
func (s *AuthService) QrLoginCallback(req *QrLoginCallbackRequest) (*LoginResponse, error) {
	if s.getSystemConfigValue("auth.qrcode.enabled", "false") != "true" {
		return nil, errors.New("扫码登录未启用")
	}

	db := Init.GetDB()
	identity := strings.TrimSpace(req.ProviderUserID)
	if identity == "" {
		return nil, errors.New("provider_user_id 不能为空")
	}

	username := strings.TrimSpace(req.Username)
	if username == "" {
		username = "qr_" + identity
	}
	email := strings.TrimSpace(req.Email)
	if email == "" {
		email = fmt.Sprintf("%s@qrcode.local", username)
	}

	var user models.User
	if err := db.Preload("Role.Permissions").Where("username = ? OR email = ?", username, email).First(&user).Error; err != nil {
		if s.getSystemConfigValue("auth.qrcode.auto_import_user", "true") != "true" {
			return nil, errors.New("扫码用户不存在，请联系管理员先创建或开启自动导入")
		}

		roleCode := s.getSystemConfigValue("auth.qrcode.default_role", "normal_user")
		var role models.Role
		if errRole := db.Where("code = ?", roleCode).First(&role).Error; errRole != nil {
			db.Where("code = ?", "normal_user").First(&role)
		}

		user = models.User{
			Username:   username,
			Email:      email,
			RealName:   req.RealName,
			Department: req.Department,
			Phone:      req.Phone,
			RoleID:     role.ID,
			Status:     1,
			Source:     "api",
		}
		_ = user.SetPassword("qrcode_login_placeholder")
		if errCreate := db.Create(&user).Error; errCreate != nil {
			return nil, errors.New("自动导入扫码用户失败")
		}
		if errReload := db.Preload("Role.Permissions").Where("id = ?", user.ID).First(&user).Error; errReload != nil {
			return nil, errors.New("加载扫码用户失败")
		}
	}

	now := time.Now().Truncate(time.Second)
	user.LastLoginAt = &now
	db.Save(&user)

	token, err := utils.GenerateToken(&user)
	if err != nil {
		return nil, errors.New("生成令牌失败")
	}

	var permissions []string
	for _, perm := range user.Role.Permissions {
		permissions = append(permissions, perm.Code)
	}

	return &LoginResponse{
		Token:       token,
		User:        &user,
		Permissions: permissions,
		ExpiresIn:   int64(utils.GetJWTExpire().Seconds()),
	}, nil
}
