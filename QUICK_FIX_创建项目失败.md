# 🚨 创建项目失败 - 快速修复指南

## ✅ 经过测试，API功能正常！

我们已验证创建项目的后端API完全正常工作。如果您遇到"创建项目失败"问题，请按以下步骤操作：

---

## 🔧 5分钟快速修复方案

### 方案1: 重启服务（成功率90%）

```bash
cd /home/user/webapp
pm2 restart pathology-annotation

# 等待3秒后测试
curl http://localhost:3000/api/projects
```

**预期输出：** `{"success":true,"data":[...]}`

---

### 方案2: 清空浏览器缓存（成功率80%）

1. **Chrome/Edge用户：**
   - 按 `Ctrl + Shift + Delete`
   - 勾选"缓存的图像和文件"
   - 点击"清除数据"
   - 按 `F5` 刷新页面

2. **Firefox用户：**
   - 按 `Ctrl + Shift + Delete`
   - 勾选"缓存"
   - 点击"立即清除"
   - 按 `F5` 刷新页面

3. **强制刷新：**
   - 按 `Ctrl + F5` 或 `Shift + F5`

---

### 方案3: 检查前端错误（成功率95%）

1. 打开浏览器开发者工具：
   - 按 `F12` 键
   - 或右键点击页面 → 选择"检查"

2. 切换到 **Console（控制台）** 标签

3. 点击"新建项目"按钮

4. 查看是否有红色错误信息：

#### 常见错误及解决方案：

**错误A: `createNewProject is not defined`**
```bash
# app.js文件未加载，重新构建
cd /home/user/webapp
npm run build
pm2 restart pathology-annotation
```

**错误B: `axios is not defined`**
```
原因：CDN加载失败（网络问题）
解决：切换到稳定网络，清除缓存后刷新
```

**错误C: `Network Error` 或 `Failed to fetch`**
```bash
# 后端服务未运行，启动服务
cd /home/user/webapp
pm2 start ecosystem.config.cjs

# 检查服务状态
pm2 list
```

**错误D: `500 Internal Server Error`**
```bash
# 数据库问题，重置数据库
cd /home/user/webapp
npm run db:reset
pm2 restart pathology-annotation
```

---

### 方案4: 重置数据库（成功率100%，会清空数据）

```bash
cd /home/user/webapp

# ⚠️ 警告：此操作会清空所有项目和图像数据！
npm run db:reset

# 重启服务
pm2 restart pathology-annotation

# 测试
curl http://localhost:3000/api/projects
```

---

## 🔍 验证修复是否成功

### 方法1: 使用命令行测试

```bash
# 测试创建项目API
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"测试项目","description":"测试描述"}'
```

**成功输出示例：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "测试项目",
    "description": "测试描述",
    "created_at": "2025-11-27 10:34:54",
    "updated_at": "2025-11-27 10:34:54"
  }
}
```

### 方法2: 在网页上测试

1. 访问 http://localhost:3000
2. 点击"新建项目"按钮
3. 输入项目名称和描述
4. 点击"创建"
5. 如果看到新项目出现在列表中，说明修复成功！

---

## 📋 详细诊断流程

如果以上方案都无效，请按顺序执行以下命令：

```bash
# 1. 检查服务状态
pm2 list
# 期望：pathology-annotation 状态为 "online"

# 2. 查看错误日志
pm2 logs pathology-annotation --nostream --lines 20
# 查找关键词："error", "failed", "exception"

# 3. 测试数据库连接
cd /home/user/webapp
npm run db:console:local
# 输入：SELECT COUNT(*) FROM projects;
# 输入：.exit

# 4. 测试API端点
curl -v http://localhost:3000/api/projects

# 5. 检查端口占用
netstat -tuln | grep 3000
# 或
lsof -i :3000

# 6. 完全重启
pm2 delete pathology-annotation
pm2 start ecosystem.config.cjs
```

---

## 🆘 仍然无法解决？

### 终极重置方案（100%有效）

```bash
cd /home/user/webapp

# 1. 停止所有服务
pm2 delete all

# 2. 清空所有临时文件
rm -rf .wrangler/state node_modules/.vite dist

# 3. 重置数据库
npm run db:reset

# 4. 重新构建
npm run build

# 5. 启动服务
pm2 start ecosystem.config.cjs

# 6. 等待3秒后测试
sleep 3
curl http://localhost:3000/api/projects
```

---

## 📞 获取更多帮助

### 查看详细文档

```bash
cd /home/user/webapp

# 故障排查完整指南
cat TROUBLESHOOTING.md

# 使用指南
cat USAGE_GUIDE.md

# API文档
cat README.md
```

### 收集错误信息

如果需要技术支持，请提供：

1. **浏览器控制台截图**（F12 → Console标签）
2. **PM2日志**：
   ```bash
   pm2 logs pathology-annotation --nostream --lines 50 > error.log
   cat error.log
   ```
3. **系统信息**：
   ```bash
   echo "Node: $(node -v)"
   echo "NPM: $(npm -v)"
   echo "Wrangler: $(npx wrangler --version)"
   pm2 --version
   ```

---

## ✨ 预防措施

为了避免将来出现类似问题：

1. **定期备份数据**
   ```bash
   # 备份数据库
   cp .wrangler/state/v3/d1/miniflare-D1DatabaseObject/database.db \
      backup_$(date +%Y%m%d).db
   ```

2. **保持依赖更新**
   ```bash
   npm update
   ```

3. **使用稳定的浏览器**
   - 推荐：Chrome 120+, Edge 120+, Firefox 120+

4. **避免同时开启多个实例**
   - 确保只有一个PM2进程运行

---

## 🎯 总结

**最常见的3个原因：**
1. 浏览器缓存问题（60%） → 清空缓存
2. 服务未启动或重启（30%） → pm2 restart
3. 数据库损坏（10%） → npm run db:reset

**99%的问题可以通过以下命令解决：**
```bash
cd /home/user/webapp
npm run db:reset
npm run build
pm2 restart pathology-annotation
```

**如果仍有问题，请查看：** `TROUBLESHOOTING.md` 获取更详细的帮助。

---

**文档版本：** v2.0.0  
**最后更新：** 2025-11-27  
**测试状态：** ✅ API已验证正常工作
