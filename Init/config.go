// 配置文件初始化包
// 该包负责加载和配置应用程序的配置文件（config.yml）
package init

import (
	"fmt"
	"os" // 导入操作系统相关包，用于获取当前工作目录
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/viper" // 导入Viper配置管理包，用于处理配置文件
)

// InitConfig函数负责初始化配置文件
// 该函数会在应用程序启动时被调用，加载config.yml配置文件
func InitConfig() {
	// 设置默认配置（即使配置文件缺失也可运行）
	viper.SetDefault("server.port", "5000")
	viper.SetDefault("datasource.driverName", "mysql")
	viper.SetDefault("datasource.host", "127.0.0.1")
	viper.SetDefault("datasource.port", "3306")
	viper.SetDefault("datasource.database", "vulnmain")
	viper.SetDefault("datasource.username", "root")
	viper.SetDefault("datasource.password", "")
	viper.SetDefault("datasource.charset", "utf8mb4")
	viper.SetDefault("upload.dir", "uploads")

	// 允许通过环境变量覆盖配置
	// 示例：DATASOURCE_HOST、SERVER_PORT
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	viper.AutomaticEnv()

	// 获取当前工作目录路径，用于定位配置文件
	// 忽略错误返回值，因为通常情况下获取工作目录不会失败
	workdir, _ := os.Getwd()
	viper.AddConfigPath(workdir)

	// 在可执行文件目录中查找配置文件，方便通过 systemd / Docker 运行二进制
	if exePath, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exePath)
		if exeDir != "" {
			viper.AddConfigPath(exeDir)
		}
	}

	// 支持通过环境变量指定配置目录
	if configPath := os.Getenv("CONFIG_PATH"); configPath != "" {
		viper.AddConfigPath(configPath)
	}

	// 设置配置文件名称，不包含文件扩展名
	viper.SetConfigName("config")

	// 设置配置文件类型为YAML格式
	viper.SetConfigType("yml")

	// 读取并解析配置文件
	err := viper.ReadInConfig()

	// 如果读取配置文件失败，直接返回
	// 这里没有处理错误，可能会导致程序使用默认值运行
	if err != nil {
		return
	}
}

// GetUploadRoot 获取上传文件根目录（优先使用 upload.dir 配置）
// 若首选目录不可写，会自动回退到可写目录（例如可执行文件目录或 /tmp）。
func GetUploadRoot() string {
	uploadDir := strings.TrimSpace(viper.GetString("upload.dir"))
	if uploadDir == "" {
		uploadDir = "uploads"
	}

	candidates := make([]string, 0, 3)
	if filepath.IsAbs(uploadDir) {
		candidates = append(candidates, uploadDir)
	} else {
		if workdir, err := os.Getwd(); err == nil && strings.TrimSpace(workdir) != "" {
			candidates = append(candidates, filepath.Join(workdir, uploadDir))
		}
		if exePath, err := os.Executable(); err == nil {
			exeDir := filepath.Dir(exePath)
			if strings.TrimSpace(exeDir) != "" {
				candidates = append(candidates, filepath.Join(exeDir, uploadDir))
			}
		}
	}

	fallback := filepath.Join(os.TempDir(), "vulnmain", "uploads")
	candidates = append(candidates, fallback)

	seen := map[string]struct{}{}
	for _, candidate := range candidates {
		candidate = filepath.Clean(candidate)
		if candidate == "" {
			continue
		}
		if _, ok := seen[candidate]; ok {
			continue
		}
		seen[candidate] = struct{}{}
		if err := ensureWritableDir(candidate); err == nil {
			return candidate
		}
	}

	_ = ensureWritableDir(fallback)
	return fallback
}

// ensureWritableDir 确保目录存在且可写。
func ensureWritableDir(dir string) error {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	probeFile := filepath.Join(dir, fmt.Sprintf(".write_probe_%d", time.Now().UnixNano()))
	if err := os.WriteFile(probeFile, []byte("ok"), 0644); err != nil {
		return err
	}
	_ = os.Remove(probeFile)
	return nil
}
