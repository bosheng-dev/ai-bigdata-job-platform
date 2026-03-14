# Kubernetes部署指南

## 概述

本目录包含将ai-bigdata-job-platform部署到Kubernetes集群所需的全部配置文件。

## 文件说明

| 文件 | 说明 |
|------|------|
| namespace.yaml | 命名空间配置 |
| configmap.yaml | 应用配置（非敏感信息） |
| secret.yaml | 敏感信息配置（需手动填写） |
| pvc.yaml | 持久化存储配置 |
| deployment.yaml | 应用部署配置 |
| service.yaml | 服务暴露配置 |
| ingress.yaml | 入口路由配置 |
| hpa.yaml | 自动扩缩容配置 |
| cronjob-crawl.yaml | 爬虫定时任务 |
| cronjob-email.yaml | 邮件发送定时任务 |

## 部署步骤

### 1. 准备环境

确保已安装：
- kubectl
- 可用的Kubernetes集群（minikube/kind/云厂商）

### 2. 配置Secret

编辑 `secret.yaml`，填写base64编码的敏感信息：

```bash
# 生成base64编码
echo -n 'your-email-password' | base64
echo -n 'your-jwt-secret' | base64
echo -n 'your-api-key' | base64
```

将生成的值填入 `secret.yaml`。

### 3. 构建镜像

```bash
# 构建Docker镜像
docker build -t job-platform:latest .

# 如果使用minikube，需要加载镜像到集群
minikube image load job-platform:latest
```

### 4. 部署应用

```bash
# 按顺序部署
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f secret.yaml
kubectl apply -f pvc.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml
kubectl apply -f hpa.yaml
kubectl apply -f cronjob-crawl.yaml
kubectl apply -f cronjob-email.yaml
```

或者使用kustomize：

```bash
kubectl apply -k .
```

### 5. 验证部署

```bash
# 查看Pod状态
kubectl get pods -n job-platform

# 查看服务
kubectl get svc -n job-platform

# 查看Ingress
kubectl get ingress -n job-platform

# 查看日志
kubectl logs -f deployment/job-platform -n job-platform
```

## 访问应用

### 使用minikube

```bash
# 开启隧道
minikube tunnel

# 获取访问地址
kubectl get svc -n job-platform
```

### 使用Ingress

确保已安装Ingress Controller（如nginx-ingress）。

配置hosts文件：
```
127.0.0.1 job-platform.example.com
```

访问：`https://job-platform.example.com`

## 运维命令

### 查看日志

```bash
# 查看应用日志
kubectl logs -f deployment/job-platform -n job-platform

# 查看爬虫任务日志
kubectl logs -f job/job-platform-crawl-xxxxx -n job-platform
```

### 扩缩容

```bash
# 手动扩容
kubectl scale deployment job-platform --replicas=5 -n job-platform

# 查看HPA状态
kubectl get hpa -n job-platform
```

### 更新应用

```bash
# 更新镜像
kubectl set image deployment/job-platform job-platform=job-platform:v2.0 -n job-platform

# 查看滚动更新状态
kubectl rollout status deployment/job-platform -n job-platform

# 回滚
kubectl rollout undo deployment/job-platform -n job-platform
```

### 进入容器

```bash
kubectl exec -it deployment/job-platform -n job-platform -- /bin/sh
```

## 监控

### 查看资源使用

```bash
kubectl top pods -n job-platform
kubectl top nodes
```

### 查看事件

```bash
kubectl get events -n job-platform --sort-by='.lastTimestamp'
```

## 清理

```bash
# 删除所有资源
kubectl delete -f .

# 或者删除整个命名空间
kubectl delete namespace job-platform
```

## 注意事项

1. **数据持久化**：使用PVC持久化SQLite数据库，确保数据不丢失
2. **Secret管理**：生产环境建议使用Vault或云厂商密钥管理服务
3. **资源限制**：根据实际负载调整resources配置
4. **健康检查**：已配置liveness和readiness探针
5. **自动扩缩容**：HPA根据CPU/内存使用率自动扩缩容

## 参考

- [Kubernetes官方文档](https://kubernetes.io/docs/)
- [kubectl命令参考](https://kubernetes.io/docs/reference/kubectl/)
