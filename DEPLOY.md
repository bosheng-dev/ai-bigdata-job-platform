# 部署指南

## 高职AI与大数据就业平台部署文档

### 系统要求

- Node.js >= 18.0.0
- SQLite3
- 内存 >= 512MB
- 磁盘 >= 1GB

### 环境变量配置

创建 `.env` 文件：

```bash
# 服务器配置
PORT=3000
NODE_ENV=production

# 邮件服务（可选，用于订阅功能）
SMTP_HOST=smtp.qq.com
SMTP_PORT=587
SMTP_USER=your-email@qq.com
SMTP_PASS=your-smtp-password

# 微信服务（可选）
WECHAT_APPID=your-appid
WECHAT_APPSECRET=your-appsecret
WECHAT_TEMPLATE_ID=your-template-id
```

### 部署步骤

#### 1. 克隆代码

```bash
git clone https://github.com/bosheng-dev/ai-bigdata-job-platform.git
cd ai-bigdata-job-platform
```

#### 2. 安装依赖

```bash
npm install --production
```

#### 3. 初始化数据库

```bash
# 数据库会自动创建，无需手动初始化
# 数据文件位于 data/jobs.db
```

#### 4. 启动服务

```bash
# 开发模式
npm start

# 生产模式（使用PM2）
npm install -g pm2
pm2 start server.js --name "job-platform"
pm2 save
pm2 startup
```

#### 5. 配置Nginx（推荐）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 服务管理

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs job-platform

# 重启服务
pm2 restart job-platform

# 停止服务
pm2 stop job-platform
```

### 数据备份

```bash
# 备份数据库
cp data/jobs.db data/jobs.db.backup.$(date +%Y%m%d)

# 恢复数据库
cp data/jobs.db.backup.20240312 data/jobs.db
```

### 更新部署

```bash
# 拉取最新代码
git pull origin main

# 重启服务
pm2 restart job-platform
```

### 访问地址

- 用户端：http://your-domain.com/
- 管理后台：http://your-domain.com/admin
- API文档：http://your-domain.com/api/health

### 定时任务说明

服务启动后自动运行以下定时任务：

| 时间 | 任务 | 说明 |
|------|------|------|
| 02:00 | 职位抓取 | 自动抓取新职位 |
| 03:00 | 数据清理 | 清理过期职位 |
| 09:00 | 职位推荐 | 发送订阅邮件 |
| 每小时 | 统计更新 | 更新统计数据 |

### 常见问题

#### 1. 端口被占用

```bash
# 修改端口
PORT=3001 npm start
```

#### 2. 数据库权限错误

```bash
# 确保数据目录可写
chmod -R 755 data/
```

#### 3. 邮件发送失败

- 检查SMTP配置
- 确认邮箱开启SMTP服务
- 查看日志排查错误

### 安全建议

1. 使用HTTPS（配置SSL证书）
2. 定期备份数据库
3. 设置防火墙规则
4. 使用强密码
5. 定期更新依赖

### 联系方式

如有问题，请提交 Issue 或联系管理员。
