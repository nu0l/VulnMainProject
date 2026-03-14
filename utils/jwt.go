// JWT工具包
// 该包提供JWT令牌的生成、解析、刷新等功能
package utils

import (
	"crypto/rand"        // 导入安全随机数包，用于生成临时密钥
	"encoding/base64"    // 导入base64编码包，用于输出可存储密钥
	"errors"             // 导入错误处理包
	"log"                // 导入日志包，用于输出安全告警
	"os"                 // 导入操作系统包，用于读取环境变量
	"strconv"            // 导入字符串转换包，用于配置值转换
	"strings"            // 导入字符串处理包，用于配置值清洗
	"sync"               // 导入同步包，用于一次性初始化密钥
	"time"               // 导入时间包，用于处理过期时间
	Init "vulnmain/Init" // 导入初始化包，获取数据库连接
	"vulnmain/models"    // 导入模型包，使用系统配置模型

	"github.com/golang-jwt/jwt/v4" // 导入JWT处理包
)

// Claims结构体定义JWT声明信息
// 包含用户基本信息和标准JWT声明
type Claims struct {
	UserID             uint   `json:"user_id"`   // 用户ID
	Username           string `json:"username"`  // 用户名
	RoleCode           string `json:"role_code"` // 角色代码
	jwt.StandardClaims        // JWT标准声明，包含过期时间等
}

var (
	jwtSecretOnce sync.Once
	jwtSecret     string
)

// GetJWTSecret函数获取JWT签名密钥
// 优先级：数据库配置 > 环境变量 > 进程内随机密钥（仅应急）
func GetJWTSecret() string {
	jwtSecretOnce.Do(func() {
		jwtSecret = resolveJWTSecret()
	})
	return jwtSecret
}

func resolveJWTSecret() string {
	// 1) 优先使用数据库配置，便于运行期通过系统配置管理
	db := Init.GetDB()
	var config models.SystemConfig
	if err := db.Where("`key` = ?", "auth.jwt.secret").First(&config).Error; err == nil {
		if secret := strings.TrimSpace(config.Value); secret != "" {
			return secret
		}
	}

	// 2) 其次使用环境变量，方便容器/部署场景安全注入
	for _, key := range []string{"AUTH_JWT_SECRET", "JWT_SECRET"} {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value
		}
	}

	// 3) 最后回退到进程级随机密钥（重启会失效），避免固定弱默认值
	secret, err := generateRandomJWTSecret()
	if err != nil {
		log.Panicf("[FATAL] auth.jwt.secret/AUTH_JWT_SECRET 未配置且随机密钥生成失败: %v", err)
	}
	log.Printf("[WARN] auth.jwt.secret/AUTH_JWT_SECRET 未配置，已使用进程级随机JWT密钥；服务重启后旧Token将失效")
	return secret
}

func generateRandomJWTSecret() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

// GetJWTExpire函数获取JWT过期时间
// 从系统配置中读取过期时间，如果不存在则返回默认值
func GetJWTExpire() time.Duration {
	// 获取数据库连接
	db := Init.GetDB()
	var config models.SystemConfig
	// 查询JWT过期时间配置
	if err := db.Where("`key` = ?", "auth.jwt.expire").First(&config).Error; err != nil {
		// 如果没有找到配置，返回默认值（2小时）
		return 2 * time.Hour
	}

	// 将配置值（小时数）转换为时间间隔
	if hours, err := strconv.Atoi(config.Value); err == nil {
		return time.Duration(hours) * time.Hour
	}

	// 转换失败，返回默认值（2小时）
	return 2 * time.Hour
}

// GenerateToken函数为用户生成JWT令牌
// 根据用户信息创建包含用户ID、用户名、角色等信息的JWT令牌
func GenerateToken(user *models.User) (string, error) {
	// 获取当前时间
	nowTime := time.Now()
	// 计算令牌过期时间
	expireTime := nowTime.Add(time.Duration(GetJWTExpire()))

	// 创建JWT声明
	claims := Claims{
		UserID:   user.ID,        // 用户ID
		Username: user.Username,  // 用户名
		RoleCode: user.Role.Code, // 角色代码
		StandardClaims: jwt.StandardClaims{
			ExpiresAt: expireTime.Unix(), // 过期时间（Unix时间戳）
			IssuedAt:  nowTime.Unix(),    // 签发时间（Unix时间戳）
			Issuer:    "vulnmain",        // 签发者
		},
	}

	// 使用HS256算法创建令牌
	tokenClaims := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	// 使用密钥签名令牌
	token, err := tokenClaims.SignedString([]byte(GetJWTSecret()))

	return token, err
}

// ParseToken函数解析JWT令牌
// 验证令牌有效性并返回令牌中的声明信息
func ParseToken(token string) (*Claims, error) {
	// 解析JWT令牌
	tokenClaims, err := jwt.ParseWithClaims(token, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		// 返回用于验证签名的密钥
		return []byte(GetJWTSecret()), nil
	})

	// 如果令牌解析成功
	if tokenClaims != nil {
		// 提取声明信息并验证令牌有效性
		if claims, ok := tokenClaims.Claims.(*Claims); ok && tokenClaims.Valid {
			return claims, nil
		}
	}

	// 解析失败或令牌无效
	return nil, err
}

// RefreshToken函数刷新JWT令牌
// 当令牌即将过期时，为用户生成新的令牌
func RefreshToken(tokenString string) (string, error) {
	// 解析现有令牌
	claims, err := ParseToken(tokenString)
	if err != nil {
		return "", err
	}

	// 检查令牌是否即将过期（30分钟内）
	if time.Unix(claims.StandardClaims.ExpiresAt, 0).Sub(time.Now()) > 30*time.Minute {
		return "", errors.New("令牌还未到刷新时间")
	}

	// 从数据库获取最新的用户信息
	db := Init.GetDB()
	var user models.User
	if err := db.Preload("Role").Where("id = ?", claims.UserID).First(&user).Error; err != nil {
		return "", err
	}

	// 为用户生成新的令牌
	return GenerateToken(&user)
}
