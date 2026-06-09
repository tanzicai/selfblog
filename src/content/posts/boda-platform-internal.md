---
title: 博达网站群管理平台内部逻辑详解：从模板到发布的技术全链路
published: 2026-06-09
description: 深入剖析博达网站群管理平台的技术架构与运行机制，涵盖 FreeMarker 模板引擎原理、JSP/Servlet 实现层、栏目与资料库设计、发布流程的完整链路，以及二次开发的最佳实践。
tags: ["博达", "网站群", "FreeMarker", "JSP", "CMS", "技术架构", "高校信息化"]
category: 技术架构
pinned: false
---

## 概述

博达网站群管理平台（以下简称博达）是国内高校和政府机构中占有率最高的网站群 CMS 之一。它的核心设计理念是"网站群"——一套后台管理多个站点，模板驱动内容呈现，实现统一运维、分级管理。

对技术人员来说，理解博达的内部机制不只是为了运维，更是为了做二次开发和深度定制。这篇文章从源码实现层面解析博达的工作流程：**模板怎么做、栏目怎么建、资料怎么管、页面怎么发**。

---

## 一、整体架构

### 1.1 分层设计

博达采用经典的四层架构：

```
┌──────────────────────────────────────────────────┐
│                    展示层                          │
│     FreeMarker 模板 (.ftl)  +  JSP 视图           │
│     HTML/CSS/JS  ·  前台页面渲染                  │
├──────────────────────────────────────────────────┤
│                    控制层                          │
│     Servlet / Spring MVC Controller               │
│     请求分发 · 参数解析 · 权限校验                │
├──────────────────────────────────────────────────┤
│                    业务层                          │
│     Service · Manager · 发布引擎                  │
│     栏目管理 · 资料管理 · 模板管理 · 发布调度     │
├──────────────────────────────────────────────────┤
│                    数据层                          │
│     DAO / MyBatis / JDBC                          │
│     栏目表 · 资料表 · 模板表 · 站点表 · 日志表   │
└──────────────────────────────────────────────────┘
```

### 1.2 核心模块

| 模块 | 功能 | 技术实现 |
|------|------|---------|
| **站点管理** | 多站点创建、域名绑定、站点级配置 | 站点表驱动，每个站点独立目录 |
| **栏目管理** | 树形栏目结构、层级控制、访问权限 | 递归树结构，parentId 关联 |
| **模板管理** | FreeMarker 模板上传、编辑、预览 | 模板存储在文件系统或 DB |
| **资料管理** | 文档、图片、附件的内容库 | 资料表 + 文件系统双存储 |
| **发布引擎** | 静态页面生成、增量/全量发布 | FreeMarker + 文件 IO |
| **用户权限** | 角色管理、站点级/栏目级权限 | RBAC 模型 |
| **系统配置** | 全局参数、站点参数、字典管理 | properties + 配置表 |

### 1.3 请求处理流程

```
浏览器请求
    ↓
Nginx/Apache（反向代理）
    ↓
Tomcat（Servlet 容器）
    ↓
web.xml 中的 Servlet 过滤器链
    ↓  SiteFilter: 解析站点域名
    ↓  AuthFilter: 校验登录状态
    ↓
核心分发 Servlet（处理动态请求）
    ├─ /admin/* → 后台管理模块
    ├─ /api/*   → RESTful API
    └─ /*       → 前台页面访问
         ↓
    判断是否静态页面
    ├─ 是 → 直接返回已生成的 HTML
    └─ 否 → 调用发布引擎动态渲染
         ↓
    FreeMarker 解析模板 → 输出 HTML
```

---

## 二、FreeMarker 模板系统

FreeMarker 是博达的核心渲染引擎。理解 FreeMarker 的工作原理，就理解了博达的一半。

### 2.1 FreeMarker 是什么

FreeMarker 是一个基于 Java 的模板引擎，它将模板文件（.ftl）和数据模型（Java 对象）合并，输出文本（通常是 HTML）。它的核心是 **Template + Data Model = Output**。

```
模板（.ftl）:    <h1>${title}</h1>
数据模型:       {"title": "欢迎访问"}
输出:           <h1>欢迎访问</h1>
```

FreeMarker 不是 Servlet，不是 JSP，它只是一个引擎——模板本身不处理业务逻辑，只负责渲染。

### 2.2 博达中的 FreeMarker 实现

博达在 FreeMarker 基础上封装了自己的标签库和指令集。这里的关键在于两个层面：

一是**博达自定义的 FreeMarker 指令**，比如获取栏目列表、获取资料列表等功能的标签。这些指令实际上对应了后端 Java 类的执行逻辑。

二是**模板中的变量来源**，模板中的 `${xxx}` 变量由后端 Java 代码在渲染时注入，这些变量可能来自数据库查询、请求参数、或系统配置。

#### 核心标签库示例

```ftl
<#-- 获取栏目列表 -->
<@cms.channelList siteId="1" parentId="0">
  <#list channels as channel>
    <li>
      <a href="${channel.url}">${channel.name}</a>
      <#if channel.hasChildren>
        <@cms.channelList siteId="1" parentId="${channel.id}">
          <ul>
            <#list channels as subChannel>
              <li><a href="${subChannel.url}">${subChannel.name}</a></li>
            </#list>
          </ul>
        </@cms.channelList>
      </#if>
    </li>
  </#list>
</@cms.channelList>

<#-- 获取资料列表 -->
<@cms.contentList siteId="1" channelId="2" pageNo="1" pageSize="20">
  <#list contents as content>
    <article>
      <h2><a href="${content.url}">${content.title}</a></h2>
      <p>${content.publishDate?string("yyyy-MM-dd")}</p>
      <div>${content.summary}</div>
    </article>
  </#list>
</@cms.contentList>

<#-- 获取单条资料详情 -->
<@cms.contentDetail contentId="${id}">
  <h1>${content.title}</h1>
  <div>${content.author} | ${content.publishDate?string("yyyy-MM-dd")}</div>
  <div>${content.content}</div>
</@cms.contentDetail>

<#-- 获取站点配置 -->
${site.name}
${site.domain}
${site.icp}

<#-- 获取系统参数 -->
${config("siteTitle")}
${config("statCode")}
```

### 2.3 自定义标签的 Java 实现

以上这些自定义标签，在博达的后端源码中对应的是 Java 类。每个自定义标签都实现了 FreeMarker 的 `TemplateDirectiveModel` 接口。

加载博达标签就是在 FreeMarker 配置中注册这些自定义指令。博达的初始化代码通常会这样做：

```java
// 注册自定义标签的核心逻辑
Configuration cfg = new Configuration(Configuration.VERSION_2_3_32);
cfg.setServletContextForTemplateLoading(servletContext, "/WEB-INF/templates");
cfg.setDefaultEncoding("UTF-8");
cfg.setTemplateExceptionHandler(TemplateExceptionHandler.RETHROW_HANDLER);

// 注册博达自定义指令
cfg.setSharedVariable("cms", new CmsDirectiveGroup());
// 其中 CmsDirectiveGroup 内部包含：
// - channelList → ChannelListDirective
// - contentList → ContentListDirective
// - contentDetail → ContentDetailDirective
// - siteInfo → SiteInfoDirective
```

#### ChannelListDirective 实现示例

```java
public class ChannelListDirective implements TemplateDirectiveModel {

    private ChannelService channelService; // 注入栏目服务

    @Override
    public void execute(Environment env, Map params, TemplateModel[] loopVars,
                        TemplateDirectiveBody body) throws TemplateException, IOException {
        // 1. 解析参数
        String siteId = getRequiredParam(params, "siteId");
        String parentId = getParam(params, "parentId", "0");
        Integer depth = getIntParam(params, "depth", null);

        // 2. 调用业务层获取数据
        List<Channel> channels = channelService.getChannelList(siteId, parentId, depth);

        // 3. 将数据注入模板上下文
        DefaultObjectWrapperBuilder builder = new DefaultObjectWrapperBuilder(Configuration.VERSION_2_3_32);
        env.setVariable("channels", builder.build().wrap(channels));

        // 4. 渲染模板体
        if (body != null) {
            body.render(env.getOut());
        }
    }
}
```

当模板解析到 `<@cms.channelList>` 时，FreeMarker 就会调用 `ChannelListDirective.execute()`，查询数据库，将结果注入模板变量 `channels`，然后渲染标签体中的内容。

### 2.4 模板中的常用 FreeMarker 语法

#### 变量插值

```ftl
${variable}              <#-- 简单变量 -->
${variable!}             <#-- 变量不存在时输出空字符串 -->
${variable!"默认值"}      <#-- 变量不存在时输出默认值 -->
${variable?if_exists}    <#-- 旧版写法，等价于 ! -->
${(object.property)!}    <#-- 对象属性，且防止 NullPointer -->
```

#### 条件判断

```ftl
<#if condition>
  ...
<#elseif condition2>
  ...
<#else>
  ...
</#if>

<#-- 判断列表是否为空 -->
<#if list?? && list?size gt 0>
  ...
</#if>

<#-- 三元表达式 -->
${condition?string("yes", "no")}
```

#### 循环

```ftl
<#list list as item>
  ${item?index}  <#-- 索引，从 0 开始 -->
  ${item?counter} <#-- 计数，从 1 开始 -->
  ${item.name}
  <#if item?is_last?string("last", "")></#if>
<#else>
  列表为空
</#list>

<#-- 取前 N 个 -->
<#list list[0..4] as item>
  ...
</#list>
```

#### 内建函数

```ftl
${str?length}                  <#-- 字符串长度 -->
${str?substring(0, 10)}        <#-- 截取 -->
${str?trim}                    <#-- 去空格 -->
${str?html}                    <#-- HTML 转义 -->
${str?cap_first}               <#-- 首字母大写 -->
${date?string("yyyy-MM-dd")}   <#-- 日期格式化 -->
${number?string("0.00")}       <#-- 数字格式化 -->
${htmlContent?no_esc}          <#-- 不转义输出 HTML（危险！） -->
```

#### include 与 import

```ftl
<#-- 包含公共文件 -->
<#include "/common/header.ftl">
<#include "/common/footer.ftl">

<#-- 导入宏库 -->
<#import "/common/macros.ftl" as mac>
<@mac.pagination pageNo=1 totalPages=10/>
```

### 2.5 模板文件的管理

博达的模板文件通常存放在以下位置：

```
WEB-INF/templates/
├── _common/                  # 公共模板
│   ├── header.ftl            # 页头
│   ├── footer.ftl            # 页脚
│   ├── head.ftl              # <head> 部分
│   ├── nav.ftl               # 导航栏
│   ├── sidebar.ftl           # 侧边栏
│   └── macros.ftl            # 宏定义
├── index/                    # 首页模板
│   ├── index.ftl             # 首页
│   └── index_${style}.ftl    # 多风格首页
├── channel/                  # 栏目页模板
│   ├── list.ftl              # 列表页
│   ├── list_pic.ftl          # 图片列表页
│   └── list_video.ftl        # 视频列表页
├── content/                  # 内容页模板
│   ├── detail.ftl            # 详情页
│   ├── detail_article.ftl    # 文章详情
│   ├── detail_pic.ftl        # 图片详情
│   └── detail_video.ftl      # 视频详情
├── search/                   # 搜索模板
│   ├── search.ftl            # 搜索结果页
│   └── search_form.ftl       # 搜索表单
├── error/                    # 错误页面
│   ├── 404.ftl
│   ├── 500.ftl
│   └── noPermission.ftl
└── special/                  # 专题模板
    └── topic_*.ftl
```

博达后台的模板管理模块允许管理员在线编辑这些 .ftl 文件，修改后保存，下次访问时自动生效（如果开启了模板热加载）。

### 2.6 模板热加载

FreeMarker 支持模板的热加载——修改模板文件后不需要重启服务器。实现原理：

```java
Configuration cfg = new Configuration(Configuration.VERSION_2_3_32);

// 关键配置：模板更新延迟
cfg.setTemplateUpdateDelayMilliseconds(0);
// 设置为 0 表示每次请求都检查模板是否更新
// 生产环境建议设置为 5000（5秒），减轻文件系统压力

// 使用文件系统加载器，而非类路径加载器
cfg.setDirectoryForTemplateLoading(new File("/path/to/templates"));
// 文件系统加载器才能感知文件变更

// 或者使用 ServletContext 加载器
cfg.setServletContextForTemplateLoading(servletContext, "/WEB-INF/templates");
```

当 `setTemplateUpdateDelayMilliseconds(0)` 时，每次调用 `Configuration.getTemplate()` 都会检查文件的最后修改时间。如果文件时间戳变了，FreeMarker 会重新解析模板文件，生成新的 `Template` 对象。

实际实现中，博达可能做了一层自己的模板缓存，但原理相同。

### 2.7 模板中的安全处理

模板中直接输出用户输入的内容存在 XSS 风险。博达的处理方式：

```ftl
<#-- 危险：直接输出，会执行 HTML 和 JS -->
${content.title}

<#-- 安全：使用内建函数进行 HTML 转义 -->
${content.title?html}

<#-- 富文本内容：需要不转义输出（但要在后端做 XSS 过滤） -->
${content.content?no_esc}
```

博达的后端在上传资料时会对富文本内容做 XSS 过滤，然后在前台模板中需要用 `?no_esc` 输出富文本。这是一个需要特别注意的安全点——如果你在二次开发中修改了输出方式，一定要确保 XSS 过滤没有被绕过。

---

## 三、JSP/Servlet 实现层

### 3.1 web.xml 中的核心配置

博达的 web.xml 是整个应用的入口。以下是典型配置：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<web-app xmlns="http://java.sun.com/xml/ns/javaee"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://java.sun.com/xml/ns/javaee
         http://java.sun.com/xml/ns/javaee/web-app_3_0.xsd"
         version="3.0">

    <display-name>Boda Website Group Platform</display-name>

    <!-- 字符编码过滤器 -->
    <filter>
        <filter-name>encodingFilter</filter-name>
        <filter-class>org.springframework.web.filter.CharacterEncodingFilter</filter-class>
        <init-param>
            <param-name>encoding</param-name>
            <param-value>UTF-8</param-value>
        </init-param>
        <init-param>
            <param-name>forceEncoding</param-name>
            <param-value>true</param-value>
        </init-param>
    </filter>

    <!-- 站点域名解析过滤器 -->
    <filter>
        <filter-name>siteFilter</filter-name>
        <filter-class>com.boda.web.filter.SiteFilter</filter-class>
    </filter>

    <!-- 登录认证过滤器 -->
    <filter>
        <filter-name>authFilter</filter-name>
        <filter-class>com.boda.web.filter.AuthFilter</filter-class>
    </filter>

    <!-- 访问日志过滤器 -->
    <filter>
        <filter-name>accessLogFilter</filter-name>
        <filter-class>com.boda.web.filter.AccessLogFilter</filter-class>
    </filter>

    <filter-mapping>
        <filter-name>encodingFilter</filter-name>
        <url-pattern>/*</url-pattern>
    </filter-mapping>
    <filter-mapping>
        <filter-name>siteFilter</filter-name>
        <url-pattern>/*</url-pattern>
    </filter-mapping>
    <filter-mapping>
        <filter-name>authFilter</filter-name>
        <url-pattern>/admin/*</url-pattern>
    </filter-mapping>
    <filter-mapping>
        <filter-name>accessLogFilter</filter-name>
        <url-pattern>/*</url-pattern>
    </filter-mapping>

    <!-- Spring 配置 -->
    <listener>
        <listener-class>org.springframework.web.context.ContextLoaderListener</listener-class>
    </listener>
    <context-param>
        <param-name>contextConfigLocation</param-name>
        <param-value>classpath:spring/applicationContext-*.xml</param-value>
    </context-param>

    <!-- Spring MVC 前端控制器 -->
    <servlet>
        <servlet-name>springMVC</servlet-name>
        <servlet-class>org.springframework.web.servlet.DispatcherServlet</servlet-class>
        <init-param>
            <param-name>contextConfigLocation</param-name>
            <param-value>classpath:spring/springmvc-servlet.xml</param-value>
        </init-param>
        <load-on-startup>1</load-on-startup>
    </servlet>

    <!-- 静态页面访问 Servlet（处理已发布的 HTML） -->
    <servlet>
        <servlet-name>staticPageServlet</servlet-name>
        <servlet-class>com.boda.web.servlet.StaticPageServlet</servlet-class>
    </servlet>

    <!-- API Servlet -->
    <servlet>
        <servlet-name>apiServlet</servlet-name>
        <servlet-class>com.boda.web.servlet.ApiServlet</servlet-class>
    </servlet>

    <servlet-mapping>
        <servlet-name>springMVC</servlet-name>
        <url-pattern>/admin/*</url-pattern>
    </servlet-mapping>
    <servlet-mapping>
        <servlet-name>staticPageServlet</servlet-name>
        <url-pattern>*.html</url-pattern>
    </servlet-mapping>
    <servlet-mapping>
        <servlet-name>apiServlet</servlet-name>
        <url-pattern>/api/*</url-pattern>
    </servlet-mapping>

    <!-- 默认 Servlet（处理静态资源） -->
    <servlet-mapping>
        <servlet-name>default</servlet-name>
        <url-pattern>*.js</url-pattern>
        <url-pattern>*.css</url-pattern>
        <url-pattern>*.png</url-pattern>
        <url-pattern>*.jpg</url-pattern>
        <url-pattern>*.gif</url-pattern>
        <url-pattern>*.ico</url-pattern>
        <url-pattern>*.woff</url-pattern>
        <url-pattern>*.woff2</url-pattern>
    </servlet-mapping>

    <!-- Session 超时时间（分钟） -->
    <session-config>
        <session-timeout>30</session-timeout>
    </session-config>

    <!-- 欢迎页面 -->
    <welcome-file-list>
        <welcome-file>index.html</welcome-file>
        <welcome-file>index.jsp</welcome-file>
    </welcome-file-list>
</web-app>
```

### 3.2 SiteFilter — 站点域名解析

这是博达最核心的 Filter 之一。它负责根据请求的域名确定当前是哪个站点。

```java
public class SiteFilter implements Filter {

    private SiteService siteService;

    @Override
    public void init(FilterConfig filterConfig) {
        siteService = SpringContextHolder.getBean(SiteService.class);
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response,
                         FilterChain chain) throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        // 1. 从请求中提取域名
        String serverName = httpRequest.getServerName();
        // serverName 可能是 www.example.com 或 example.com

        // 2. 处理端口号（非 80 端口需要保留）
        int port = httpRequest.getServerPort();
        String domainKey = (port == 80 || port == 443)
            ? serverName
            : serverName + ":" + port;

        // 3. 从缓存或数据库中查找站点
        Site site = siteService.getSiteByDomain(domainKey);

        if (site == null) {
            // 尝试泛域名匹配 *.example.com
            site = siteService.matchWildcardDomain(serverName);
        }

        if (site == null) {
            // 找不到站点 → 使用默认站点
            site = siteService.getDefaultSite();
        }

        // 4. 将站点信息绑定到当前请求线程
        SiteContextHolder.setSite(site);

        // 5. 设置请求属性，后续 Servlet 和模板都能获取
        httpRequest.setAttribute("_site", site);
        httpRequest.setAttribute("_siteId", site.getId());

        try {
            chain.doFilter(request, response);
        } finally {
            // 6. 清理 ThreadLocal，防止内存泄漏
            SiteContextHolder.clear();
        }
    }
}
```

`SiteContextHolder` 是一个 `ThreadLocal` 封装，确保在一次请求的完整链路中，所有代码都能获取到当前站点信息。

```java
public class SiteContextHolder {
    private static final ThreadLocal<Site> siteHolder = new ThreadLocal<>();

    public static void setSite(Site site) {
        siteHolder.set(site);
    }

    public static Site getSite() {
        return siteHolder.get();
    }

    public static void clear() {
        siteHolder.remove();
    }
}
```

### 3.3 页面分发核心逻辑

当前台页面被访问时，StaticPageServlet 负责处理。它的核心逻辑如下：

```java
public class StaticPageServlet extends HttpServlet {

    @Autowired
    private PublishEngine publishEngine;

    @Autowired
    private SiteService siteService;

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // 1. 获取站点信息
        Site site = SiteContextHolder.getSite();

        // 2. 解析请求路径
        String requestUri = request.getRequestURI();
        String contextPath = request.getContextPath();
        String relativePath = requestUri.substring(contextPath.length());

        // 3. 构建发布文件的路径
        // 发布目录结构: /publish/{siteId}/{relativePath}/index.html
        String publishPath = site.getPublishRoot() + relativePath;
        if (relativePath.endsWith("/")) {
            publishPath += "index.html";
        }

        File publishFile = new File(publishPath);

        // 4. 检查是否存在已发布的静态页面
        if (publishFile.exists() && !isPreviewMode(request)) {
            // 直接返回静态 HTML（性能最优）
            response.setContentType("text/html;charset=UTF-8");
            response.setHeader("X-Cache", "HIT");
            FileUtils.copyFile(publishFile, response.getOutputStream());
            return;
        }

        // 5. 动态渲染（预览模式 或 页面未发布）
        response.setHeader("X-Cache", "DYNAMIC");

        // 5.1 解析当前访问的是栏目还是内容
        PageType pageType = resolvePageType(site, relativePath);
        // pageType 可能是: INDEX, CHANNEL_LIST, CONTENT_DETAIL, SEARCH, SPECIAL

        // 5.2 构建数据模型
        Map<String, Object> dataModel = buildDataModel(request, site, pageType, relativePath);

        // 5.3 获取对应的模板
        String templatePath = getTemplatePath(site, pageType, relativePath);
        // 例如: /channel/list.ftl, /content/detail.ftl

        // 5.4 使用 FreeMarker 渲染
        try {
            Configuration cfg = FreeMarkerConfigurer.getConfiguration();
            Template template = cfg.getTemplate(templatePath);
            template.process(dataModel, response.getWriter());
        } catch (TemplateException e) {
            throw new ServletException("Template processing error", e);
        }
    }

    /**
     * 解析页面类型
     * 例如:
     *   / → INDEX（首页）
     *   /xx/ → CHANNEL_LIST（栏目列表页）
     *   /xx/123.html → CONTENT_DETAIL（内容详情页）
     */
    private PageType resolvePageType(Site site, String path) {
        if (path == null || path.equals("/") || path.equals("/index.html")) {
            return PageType.INDEX;
        }

        // 从站点映射中查找匹配的栏目
        Channel channel = siteService.matchChannel(site.getId(), path);
        if (channel != null) {
            if (channel.getType() == ChannelType.LINK) {
                return PageType.LINK_REDIRECT;
            }
            return PageType.CHANNEL_LIST;
        }

        // 检查是否是内容详情页（路径包含数字 ID）
        Pattern pattern = Pattern.compile(".*/(\\d+)\\.html$");
        Matcher matcher = pattern.matcher(path);
        if (matcher.matches()) {
            return PageType.CONTENT_DETAIL;
        }

        // 检查是否是搜索页面
        if (path.contains("/search/")) {
            return PageType.SEARCH;
        }

        return PageType.ERROR_404;
    }
}
```

### 3.4 后台管理 JSP 页面

博达的后台管理界面使用 JSP + JSTL 实现。典型的后台页面结构如下：

```jsp
<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>
<%@ taglib prefix="fmt" uri="http://java.sun.com/jsp/jstl/fmt" %>
<%@ taglib prefix="fn" uri="http://java.sun.com/jsp/jstl/functions" %>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>栏目管理 - ${site.name}</title>
    <link rel="stylesheet" href="${pageContext.request.contextPath}/admin/css/admin.css">
</head>
<body>
    <div class="container">
        <!-- 侧边栏 -->
        <jsp:include page="/admin/_inc/sidebar.jsp"/>

        <!-- 主内容 -->
        <div class="main-content">
            <div class="page-header">
                <h3>栏目管理</h3>
                <div class="breadcrumb">
                    <a href="${pageContext.request.contextPath}/admin/">首页</a> &gt;
                    栏目管理
                </div>
            </div>

            <!-- 操作按钮 -->
            <div class="toolbar">
                <a href="${pageContext.request.contextPath}/admin/channel/add"
                   class="btn btn-primary">新增栏目</a>
                <a href="${pageContext.request.contextPath}/admin/channel/sort"
                   class="btn btn-default">排序</a>
                <button onclick="batchDelete()" class="btn btn-danger">批量删除</button>
            </div>

            <!-- 栏目树表格 -->
            <table class="table table-tree">
                <thead>
                    <tr>
                        <th style="width:30px"><input type="checkbox" id="selectAll"></th>
                        <th>栏目名称</th>
                        <th>类型</th>
                        <th>状态</th>
                        <th>访问路径</th>
                        <th>模板</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    <c:forEach items="${channelList}" var="ch">
                        <tr data-id="${ch.id}" data-pid="${ch.parentId}"
                            style="padding-left:${ch.depth * 20}px">
                            <td><input type="checkbox" name="ids" value="${ch.id}"></td>
                            <td>
                                <span class="tree-indent" style="display:inline-block;
                                      width:${ch.depth * 20}px"></span>
                                <c:if test="${ch.hasChildren}">
                                    <span class="tree-toggle expanded"
                                          onclick="toggleTree(this)"></span>
                                </c:if>
                                ${ch.name}
                                <c:if test="${ch.isTop}">
                                    <span class="badge badge-primary">顶部</span>
                                </c:if>
                            </td>
                            <td>${ch.type.displayName}</td>
                            <td>
                                <c:choose>
                                    <c:when test="${ch.status == 'published'}">
                                        <span class="label label-success">已发布</span>
                                    </c:when>
                                    <c:when test="${ch.status == 'draft'}">
                                        <span class="label label-warning">草稿</span>
                                    </c:when>
                                    <c:otherwise>
                                        <span class="label label-default">${ch.status}</span>
                                    </c:otherwise>
                                </c:choose>
                            </td>
                            <td><code>${ch.path}</code></td>
                            <td>${ch.listTemplate}</td>
                            <td>
                                <a href="${pageContext.request.contextPath}/admin/channel/edit?id=${ch.id}">编辑</a>
                                <a href="${pageContext.request.contextPath}/admin/content/list?channelId=${ch.id}">内容</a>
                                <a href="${pageContext.request.contextPath}/admin/publish?channelId=${ch.id}">发布</a>
                                <a href="javascript:void(0)" onclick="deleteChannel(${ch.id})">删除</a>
                            </td>
                        </tr>
                    </c:forEach>
                </tbody>
            </table>
        </div>
    </div>

    <script src="${pageContext.request.contextPath}/admin/js/jquery.min.js"></script>
    <script src="${pageContext.request.contextPath}/admin/js/admin.js"></script>
    <script>
        function toggleTree(el) {
            $(el).toggleClass('expanded collapsed');
            var tr = $(el).closest('tr');
            var id = tr.data('id');
            $('tr[data-pid="' + id + '"]').toggle();
        }

        function deleteChannel(id) {
            if (!confirm('确定删除该栏目及其所有子栏目和内容？')) return;
            $.post('${pageContext.request.contextPath}/admin/channel/delete', {id: id},
                function(res) {
                    if (res.code === 200) {
                        location.reload();
                    } else {
                        alert(res.message);
                    }
                });
        }
    </script>
</body>
</html>
```

---

## 四、栏目管理

### 4.1 栏目数据模型

栏目是博达内容组织的核心骨架。在数据库中，栏目的表结构大致如下：

```sql
CREATE TABLE `cms_channel` (
  `id`          INT           NOT NULL AUTO_INCREMENT   COMMENT '栏目ID',
  `site_id`     INT           NOT NULL                   COMMENT '所属站点ID',
  `parent_id`   INT           DEFAULT 0                  COMMENT '父栏目ID，0表示顶级',
  `name`        VARCHAR(100)  NOT NULL                   COMMENT '栏目名称',
  `path`        VARCHAR(200)  NOT NULL                   COMMENT '访问路径（URL中的路径段）',
  `sort`        INT           DEFAULT 0                  COMMENT '排序号',
  `depth`       INT           DEFAULT 1                  COMMENT '层级深度',
  `type`        VARCHAR(20)   DEFAULT 'channel'           COMMENT '栏目类型',
  `status`      VARCHAR(20)   DEFAULT 'draft'             COMMENT '状态',
  `list_template`    VARCHAR(200) DEFAULT ''              COMMENT '列表页模板路径',
  `detail_template`  VARCHAR(200) DEFAULT ''              COMMENT '详情页模板路径',
  `link_url`    VARCHAR(500)  DEFAULT ''                  COMMENT '外部链接URL',
  `keywords`    VARCHAR(200)  DEFAULT ''                  COMMENT 'SEO关键词',
  `description` VARCHAR(500)  DEFAULT ''                  COMMENT 'SEO描述',
  `is_top`      TINYINT       DEFAULT 0                  COMMENT '是否顶部导航',
  `is_bottom`   TINYINT       DEFAULT 0                  COMMENT '是否底部导航',
  `is_show`     TINYINT       DEFAULT 1                  COMMENT '是否显示',
  `allow_comment` TINYINT     DEFAULT 1                  COMMENT '是否允许评论',
  `page_size`   INT           DEFAULT 20                 COMMENT '列表页每页条数',
  `roles`       VARCHAR(500)  DEFAULT ''                  COMMENT '可访问角色ID列表',
  `create_by`   INT           DEFAULT 0                  COMMENT '创建人',
  `create_time` DATETIME      DEFAULT CURRENT_TIMESTAMP   COMMENT '创建时间',
  `update_time` DATETIME      DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_path` (`site_id`, `path`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='栏目表';
```

### 4.2 栏目树结构的实现

博达的栏目是典型的树形结构，使用 `parent_id` 自关联。查询子树时，最简单的做法是递归查询，但在数据量大的场景下性能不好。博达的优化手段：

**方法一：一次性加载整棵树（适用于栏目数少于 500 的场景）**

```java
public class ChannelServiceImpl implements ChannelService {

    public List<ChannelTreeNode> getChannelTree(Integer siteId) {
        // 1. 一次性查出该站点所有栏目
        List<Channel> allChannels = channelDao.selectBySiteId(siteId);

        // 2. 在内存中构建树
        Map<Integer, List<Channel>> parentMap = allChannels.stream()
            .collect(Collectors.groupingBy(Channel::getParentId));

        // 3. 从根节点开始递归构建树
        List<ChannelTreeNode> tree = buildTree(parentMap, 0, 1);
        return tree;
    }

    private List<ChannelTreeNode> buildTree(
            Map<Integer, List<Channel>> parentMap,
            Integer parentId, int depth) {
        List<Channel> children = parentMap.getOrDefault(parentId, Collections.emptyList());
        List<ChannelTreeNode> nodes = new ArrayList<>();

        for (Channel ch : children) {
            ChannelTreeNode node = new ChannelTreeNode();
            node.setId(ch.getId());
            node.setName(ch.getName());
            node.setDepth(depth);
            node.setHasChildren(parentMap.containsKey(ch.getId()));
            // 递归构建子节点
            node.setChildren(buildTree(parentMap, ch.getId(), depth + 1));
            nodes.add(node);
        }

        // 按 sort 字段排序
        nodes.sort(Comparator.comparingInt(ChannelTreeNode::getSort));
        return nodes;
    }
}
```

**方法二：使用闭包表（Closure Table）适用于大规模栏目的场景**

闭包表是一种用空间换时间的树结构方案。额外建一张表记录所有祖先-后代关系：

```sql
CREATE TABLE `cms_channel_closure` (
  `ancestor`   INT NOT NULL COMMENT '祖先节点ID',
  `descendant` INT NOT NULL COMMENT '后代节点ID',
  `depth`      INT NOT NULL COMMENT '层级差（0表示自身）',
  PRIMARY KEY (`ancestor`, `descendant`),
  KEY `idx_descendant` (`descendant`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='栏目闭包表';
```

查询某个栏目下的所有子栏目（任意层级）：

```sql
-- 获取 /about/ 栏目下的所有子栏目（包括间接子栏目）
SELECT c.* FROM cms_channel c
JOIN cms_channel_closure cl ON c.id = cl.descendant
WHERE cl.ancestor = (SELECT id FROM cms_channel WHERE path = '/about/' AND site_id = ?)
  AND cl.depth > 0
ORDER BY c.sort;
```

查询某个栏目的所有父栏目（面包屑导航）：

```sql
-- 获取当前栏目的所有父栏目（用于面包屑）
SELECT c.* FROM cms_channel c
JOIN cms_channel_closure cl ON c.id = cl.ancestor
WHERE cl.descendant = ?
ORDER BY cl.depth DESC;
```

### 4.3 栏目类型

博达的栏目有多种类型，每种类型的行为不同：

| 类型 | 说明 | 处理逻辑 |
|------|------|---------|
| **普通栏目** | 有列表页和内容页 | 列表页展示内容列表，详情页展示单条内容 |
| **单页栏目** | 只有一个页面（如"关于我们"） | 列表页即详情页，不需要内容列表 |
| **外部链接** | 跳转到外部 URL | 访问时直接 302 重定向 |
| **内部跳转** | 跳转到站内其他栏目 | 访问时直接 302 跳转 |
| **聚合栏目** | 聚合多个子栏目的内容 | 列表页展示所有子栏目的最新内容 |

### 4.4 栏目路径与 URL 生成

每个栏目有一个 `path` 字段，用于生成 URL。路径的组装规则：

```java
public String buildChannelUrl(Site site, Channel channel) {
    // 如果是外部链接，直接返回
    if (channel.getType() == ChannelType.LINK) {
        return channel.getLinkUrl();
    }

    // 如果是内部跳转，递归获取目标栏目 URL
    if (channel.getType() == ChannelType.REDIRECT) {
        Channel target = channelDao.selectById(channel.getRedirectId());
        return buildChannelUrl(site, target);
    }

    // 普通栏目：递归从根节点组装路径
    StringBuilder path = new StringBuilder(channel.getPath());
    Integer parentId = channel.getParentId();

    while (parentId != null && parentId != 0) {
        Channel parent = channelDao.selectById(parentId);
        if (parent == null) break;
        path.insert(0, parent.getPath().endsWith("/")
            ? parent.getPath() : parent.getPath() + "/");
        parentId = parent.getParentId();
    }

    // 最终 URL: /parent/child/index.html
    String fullPath = path.toString();
    if (!fullPath.endsWith("/")) {
        fullPath += "/";
    }
    fullPath += "index.html";

    return site.getDomain() + fullPath;
}
```

### 4.5 栏目创建流程

在博达后台创建一个栏目的完整流程：

```
1. 管理员进入"栏目管理" → 点击"新增栏目"
       ↓
2. JSP 页面加载 → Controller 返回表单页面
       ↓
3. 管理员填写表单：
   - 栏目名称（必填）
   - 父栏目（默认为顶级）
   - 访问路径（自动生成或手动填写）
   - 栏目类型（普通/单页/链接/跳转/聚合）
   - 列表模板、详情模板
   - SEO 信息
   - 权限设置
       ↓
4. 提交表单 → POST /admin/channel/add
       ↓
5. Controller 接收参数
   ↓
6. Service 层校验：
   - 名称是否重复
   - 路径是否与其他栏目冲突
   - 父栏目是否存在
   - 模板文件是否存在
       ↓
7. DAO 层插入数据库
   ↓
8. 更新闭包表（如果使用）
   ↓
9. 记录操作日志
   ↓
10. 返回成功 → 页面刷新显示新栏目
```

对应的 Controller 代码大致如下：

```java
@Controller
@RequestMapping("/admin/channel")
public class ChannelController {

    @Autowired
    private ChannelService channelService;

    @Autowired
    private LogService logService;

    @GetMapping("/add")
    public String addForm(Model model) {
        Site site = SiteContextHolder.getSite();
        model.addAttribute("site", site);
        model.addAttribute("channelTree", channelService.getChannelTree(site.getId()));
        model.addAttribute("templateList", templateService.getTemplates(site.getId()));
        return "admin/channel/add";
    }

    @PostMapping("/add")
    @ResponseBody
    public Result add(@Validated ChannelAddDTO dto, BindingResult result) {
        if (result.hasErrors()) {
            return Result.error(result.getAllErrors().get(0).getDefaultMessage());
        }

        Site site = SiteContextHolder.getSite();
        dto.setSiteId(site.getId());

        try {
            Channel channel = channelService.addChannel(dto);
            logService.log(LogType.CHANNEL, "新增栏目: " + channel.getName(),
                          channel.getId());
            return Result.success(channel);
        } catch (BusinessException e) {
            return Result.error(e.getMessage());
        }
    }
}
```

---

## 五、资料库（内容管理）

### 5.1 资料数据模型

资料（内容）是博达中最核心的业务数据。它的表结构反映了博达设计的核心思路——内容与展现分离。

```sql
CREATE TABLE `cms_content` (
  `id`            INT           NOT NULL AUTO_INCREMENT   COMMENT '资料ID',
  `site_id`       INT           NOT NULL                   COMMENT '所属站点ID',
  `channel_id`    INT           NOT NULL                   COMMENT '所属栏目ID',
  `title`         VARCHAR(300)  NOT NULL                   COMMENT '标题',
  `sub_title`     VARCHAR(300)  DEFAULT ''                  COMMENT '副标题',
  `short_title`   VARCHAR(100)  DEFAULT ''                  COMMENT '短标题',
  `keywords`      VARCHAR(200)  DEFAULT ''                  COMMENT '关键词',
  `summary`       VARCHAR(1000) DEFAULT ''                  COMMENT '摘要',
  `author`        VARCHAR(100)  DEFAULT ''                  COMMENT '作者',
  `source`        VARCHAR(200)  DEFAULT ''                  COMMENT '来源',
  `content`       MEDIUMTEXT                               COMMENT '正文内容（HTML格式）',
  `status`        VARCHAR(20)   DEFAULT 'draft'             COMMENT '状态',
  `sort`          INT           DEFAULT 0                  COMMENT '排序号',
  `is_top`        TINYINT       DEFAULT 0                  COMMENT '是否置顶',
  `is_recommend`  TINYINT       DEFAULT 0                  COMMENT '是否推荐',
  `is_slide`      TINYINT       DEFAULT 0                  COMMENT '是否轮播',
  `is_bold`       TINYINT       DEFAULT 0                  COMMENT '标题是否加粗',
  `link_url`      VARCHAR(500)  DEFAULT ''                  COMMENT '跳转链接',
  `publish_date`  DATETIME      DEFAULT NULL               COMMENT '发布时间',
  `create_by`     INT           DEFAULT 0                  COMMENT '创建人',
  `create_time`   DATETIME      DEFAULT CURRENT_TIMESTAMP   COMMENT '创建时间',
  `update_time`   DATETIME      DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_site_channel` (`site_id`, `channel_id`),
  KEY `idx_publish_date` (`publish_date`),
  KEY `idx_status` (`status`),
  FULLTEXT KEY `ft_title_content` (`title`, `content`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资料表';
```

### 5.2 扩展字段体系

博达支持自定义扩展字段，这是通过额外的扩展属性表实现的：

```sql
CREATE TABLE `cms_content_attr` (
  `id`         INT           NOT NULL AUTO_INCREMENT,
  `content_id` INT           NOT NULL        COMMENT '资料ID',
  `attr_name`  VARCHAR(100)  NOT NULL        COMMENT '属性名',
  `attr_value` TEXT                           COMMENT '属性值',
  `attr_type`  VARCHAR(20)   DEFAULT 'text'  COMMENT '属性类型',
  `sort`       INT           DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_content_id` (`content_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资料扩展属性表';
```

扩展字段的配置存储在系统配置表或 XML 配置中：

```xml
<!-- 栏目扩展字段配置示例 -->
<extFields>
    <field name="fileNo" displayName="发文字号" type="text"/>
    <field name="validDate" displayName="有效期" type="date"/>
    <field name="attachment" displayName="附件" type="file"/>
    <field name="relatedNews" displayName="相关新闻" type="multiText"/>
</extFields>
```

### 5.3 资料与附件管理

博达的附件管理涉及文件和数据库两部分。附件上传后存储在文件系统中，同时在数据库中记录元数据：

```sql
CREATE TABLE `cms_attachment` (
  `id`           INT           NOT NULL AUTO_INCREMENT,
  `content_id`   INT           DEFAULT 0        COMMENT '关联资料ID',
  `file_name`    VARCHAR(300)  NOT NULL          COMMENT '原始文件名',
  `file_path`    VARCHAR(500)  NOT NULL          COMMENT '存储路径',
  `file_size`    BIGINT        DEFAULT 0         COMMENT '文件大小（字节）',
  `file_type`    VARCHAR(50)   DEFAULT ''        COMMENT '文件MIME类型',
  `suffix`       VARCHAR(10)   DEFAULT ''        COMMENT '文件后缀',
  `is_image`     TINYINT       DEFAULT 0         COMMENT '是否图片',
  `width`        INT           DEFAULT 0         COMMENT '图片宽度',
  `height`       INT           DEFAULT 0         COMMENT '图片高度',
  `download_count` INT        DEFAULT 0          COMMENT '下载次数',
  `create_time`  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_content_id` (`content_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='附件表';
```

附件的存储路径生成规则：

```java
public String generateFilePath(String originalFileName, Integer siteId) {
    // 按日期分目录，避免单目录文件过多
    String datePath = new SimpleDateFormat("yyyy/MM/dd").format(new Date());

    // 生成唯一文件名
    String uuid = UUID.randomUUID().toString().replace("-", "");
    String suffix = originalFileName.substring(originalFileName.lastIndexOf("."));

    // 最终路径: /uploads/{siteId}/{datePath}/{uuid}{suffix}
    return String.format("/uploads/%d/%s/%s%s", siteId, datePath, uuid, suffix);
}
```

### 5.4 资料发布状态机

资料的状态流转：

```
                ┌──────────┐
                │   草稿    │
                └────┬─────┘
                     │ 提交
                     ↓
                ┌──────────┐
          ┌─────│  待审核   │─────┐
          │     └────┬─────┘     │
          │          │ 审核通过   │ 审核驳回
          │          ↓           │
          │     ┌──────────┐     │
          │     │  已通过   │     │
          │     └────┬─────┘     │
          │          │ 发布       │
          │          ↓           │
          │     ┌──────────┐     │
          │     │  已发布   │─────┘
          │     └────┬─────┘
          │          │ 取消发布
          │          ↓
          │     ┌──────────┐
          └─────│  已下架   │
                └──────────┘
```

状态管理的 Service 层实现：

```java
@Service
public class ContentServiceImpl implements ContentService {

    // 审核内容
    @Transactional
    public void approve(Integer contentId, Integer reviewerId) {
        Content content = contentDao.selectById(contentId);
        if (content.getStatus() != ContentStatus.PENDING) {
            throw new BusinessException("当前状态不允许审核");
        }

        Content update = new Content();
        update.setId(contentId);
        update.setStatus(ContentStatus.APPROVED);
        update.setReviewerId(reviewerId);
        update.setReviewTime(new Date());
        contentDao.update(update);
    }

    // 发布内容
    @Transactional
    public void publish(Integer contentId, Integer publisherId) {
        Content content = contentDao.selectById(contentId);
        if (content.getStatus() != ContentStatus.APPROVED) {
            throw new BusinessException("只有已审核的内容才能发布");
        }

        Content update = new Content();
        update.setId(contentId);
        update.setStatus(ContentStatus.PUBLISHED);
        update.setPublisherId(publisherId);
        update.setPublishDate(new Date());
        contentDao.update(update);

        // 触发发布事件 → 异步生成静态页面
        publishEngine.publishContent(content.getSiteId(),
                                     content.getChannelId(), contentId);
    }
}
```

### 5.5 资料列表查询

博达的列表查询支持多种筛选和排序条件，核心 DAO 层使用 MyBatis 动态 SQL：

```xml
<select id="selectContentList" resultMap="contentMap">
    SELECT * FROM cms_content
    <where>
        <if test="siteId != null">
            AND site_id = #{siteId}
        </if>
        <if test="channelIds != null and channelIds.size > 0">
            AND channel_id IN
            <foreach collection="channelIds" item="id" open="(" separator="," close=")">
                #{id}
            </foreach>
        </if>
        <if test="status != null">
            AND status = #{status}
        </if>
        <if test="keyword != null and keyword != ''">
            AND (title LIKE CONCAT('%', #{keyword}, '%')
                 OR summary LIKE CONCAT('%', #{keyword}, '%'))
        </if>
        <if test="startDate != null">
            AND publish_date &gt;= #{startDate}
        </if>
        <if test="endDate != null">
            AND publish_date &lt;= #{endDate}
        </if>
        <if test="isTop != null">
            AND is_top = #{isTop}
        </if>
        <if test="isRecommend != null">
            AND is_recommend = #{isRecommend}
        </if>
    </where>
    ORDER BY
        is_top DESC,      <!-- 置顶优先 -->
        sort ASC,         <!-- 排序号 -->
        publish_date DESC <!-- 最新优先 -->
    LIMIT #{offset}, #{pageSize}
</select>
```

---

## 六、发布引擎

发布引擎是博达最核心的模块。它负责将模板和数据模型合并，生成静态 HTML 文件。

### 6.1 发布模式

博达支持两种发布模式：

| 模式 | 触发条件 | 性能 | 使用场景 |
|------|---------|------|---------|
| **全量发布** | 手动触发、站点初始化 | 慢（全站重新生成） | 更换模板、初始化站点 |
| **增量发布** | 内容审核通过、模板修改 | 快（只发布变更部分） | 日常内容更新 |
| **定时发布** | Cron 表达式 | 取决于发布量 | 定时生效的内容 |
| **一键发布** | 手动点击"发布" | 中 | 管理员主动触发 |

### 6.2 发布引擎核心流程

```java
@Component
public class PublishEngine {

    private static final Logger log = LoggerFactory.getLogger(PublishEngine.class);

    @Autowired
    private Configuration freemarkerConfig;

    @Autowired
    private ChannelService channelService;

    @Autowired
    private ContentService contentService;

    @Autowired
    private SiteService siteService;

    private final ExecutorService publishExecutor =
        Executors.newFixedThreadPool(Runtime.getRuntime().availableProcessors() * 2);

    /**
     * 全量发布站点
     */
    public void fullPublish(Integer siteId) {
        Site site = siteService.getById(siteId);
        log.info("开始全量发布站点: {} (ID: {})", site.getName(), siteId);

        // 1. 清理旧的发布目录
        File publishDir = new File(site.getPublishRoot());
        FileUtils.deleteQuietly(publishDir);

        // 2. 获取站点所有栏目
        List<Channel> allChannels = channelService.getAllChannels(siteId);

        // 3. 发布首页
        publishIndex(site);

        // 4. 发布每个栏目的列表页
        for (Channel channel : allChannels) {
            publishChannelList(site, channel, 1); // 第1页
        }

        // 5. 发布每个已发布内容的详情页
        List<Content> publishedContents = contentService.getPublishedContents(siteId);
        for (Content content : publishedContents) {
            publishContentDetail(site, content);
        }

        // 6. 发布全局资源（CSS、JS、全局导航等）
        publishGlobalResources(site);

        log.info("全量发布完成: {} (ID: {})", site.getName(), siteId);
    }

    /**
     * 增量发布单条内容
     */
    public void publishContent(Integer siteId, Integer channelId, Integer contentId) {
        Site site = siteService.getById(siteId);
        Content content = contentService.getById(contentId);

        // 1. 发布内容详情页
        publishContentDetail(site, content);

        // 2. 重新发布所属栏目的列表页（列表页内容变了）
        Channel channel = channelService.getById(channelId);
        int totalPages = calculateTotalPages(site, channel);
        for (int page = 1; page <= totalPages; page++) {
            publishChannelList(site, channel, page);
        }

        // 3. 如果该栏目在首页有推荐，重新发布首页
        if (content.getIsRecommend() || content.getIsSlide()) {
            publishIndex(site);
        }

        // 4. 如果该栏目是顶级栏目，重新发布全局导航
        if (channel.getParentId() == 0) {
            publishGlobalResources(site);
        }

        log.info("增量发布完成: contentId={}", contentId);
    }

    /**
     * 发布首页
     */
    private void publishIndex(Site site) {
        try {
            // 1. 构建数据模型
            Map<String, Object> dataModel = new HashMap<>();
            dataModel.put("site", site);
            dataModel.put("channels", channelService.getTopLevelChannels(site.getId()));
            dataModel.put("recommendContents",
                contentService.getRecommendContents(site.getId(), 10));
            dataModel.put("slideContents",
                contentService.getSlideContents(site.getId(), 5));

            // 2. 获取首页模板
            Template template = freemarkerConfig.getTemplate("/index/index.ftl");

            // 3. 渲染并写入文件
            String outputPath = site.getPublishRoot() + "/index.html";
            File outputFile = new File(outputPath);
            FileUtils.forceMkdirParent(outputFile);

            try (Writer writer = new BufferedWriter(
                    new OutputStreamWriter(new FileOutputStream(outputFile), "UTF-8"))) {
                template.process(dataModel, writer);
            }

        } catch (Exception e) {
            log.error("发布首页失败: siteId={}", site.getId(), e);
        }
    }

    /**
     * 发布栏目列表页
     */
    private void publishChannelList(Site site, Channel channel, int pageNo) {
        try {
            // 1. 构建数据模型
            Map<String, Object> dataModel = new HashMap<>();
            dataModel.put("site", site);
            dataModel.put("channel", channel);
            dataModel.put("breadcrumb", channelService.getBreadcrumb(channel.getId()));

            // 2. 查询该栏目下的内容列表
            PageResult<Content> pageResult = contentService.getContentPage(
                site.getId(), channel.getId(), pageNo, channel.getPageSize());
            dataModel.put("contentList", pageResult.getList());
            dataModel.put("pageNo", pageNo);
            dataModel.put("totalPages", pageResult.getTotalPages());

            // 3. 获取列表页模板
            String templatePath = channel.getListTemplate();
            if (StringUtils.isEmpty(templatePath)) {
                templatePath = "/channel/list.ftl";
            }
            Template template = freemarkerConfig.getTemplate(templatePath);

            // 4. 确定输出路径
            // 第1页: /channelPath/index.html
            // 第N页: /channelPath/index_{N}.html
            String outputDir = site.getPublishRoot() + channel.getFullPath();
            String fileName = (pageNo == 1) ? "index.html" : "index_" + pageNo + ".html";
            File outputFile = new File(outputDir, fileName);
            FileUtils.forceMkdirParent(outputFile);

            // 5. 渲染
            try (Writer writer = new BufferedWriter(
                    new OutputStreamWriter(new FileOutputStream(outputFile), "UTF-8"))) {
                template.process(dataModel, writer);
            }

        } catch (Exception e) {
            log.error("发布栏目列表页失败: channelId={}, page={}",
                      channel.getId(), pageNo, e);
        }
    }

    /**
     * 发布内容详情页
     */
    private void publishContentDetail(Site site, Content content) {
        try {
            // 1. 构建数据模型
            Map<String, Object> dataModel = new HashMap<>();
            dataModel.put("site", site);
            dataModel.put("content", content);
            dataModel.put("channel", channelService.getById(content.getChannelId()));
            dataModel.put("breadcrumb",
                channelService.getBreadcrumb(content.getChannelId()));
            dataModel.put("attachments",
                attachmentService.getByContentId(content.getId()));
            dataModel.put("prevContent",
                contentService.getPrevContent(content.getId()));
            dataModel.put("nextContent",
                contentService.getNextContent(content.getId()));

            // 2. 获取详情页模板
            Channel channel = channelService.getById(content.getChannelId());
            String templatePath = channel.getDetailTemplate();
            if (StringUtils.isEmpty(templatePath)) {
                templatePath = "/content/detail.ftl";
            }
            Template template = freemarkerConfig.getTemplate(templatePath);

            // 3. 输出路径: /channelPath/contentId.html
            String outputDir = site.getPublishRoot() + channel.getFullPath();
            File outputFile = new File(outputDir, content.getId() + ".html");
            FileUtils.forceMkdirParent(outputFile);

            // 4. 渲染
            try (Writer writer = new BufferedWriter(
                    new OutputStreamWriter(new FileOutputStream(outputFile), "UTF-8"))) {
                template.process(dataModel, writer);
            }

        } catch (Exception e) {
            log.error("发布内容详情页失败: contentId={}", content.getId(), e);
        }
    }
}
```

### 6.3 并发发布与性能优化

全量发布时，博达使用线程池并发渲染，大幅提升发布速度：

```java
public void concurrentPublish(Site site, List<Channel> channels, List<Content> contents) {
    CountDownLatch latch = new CountDownLatch(
        1 + channels.size() + contents.size());

    // 并发发布首页
    publishExecutor.submit(() -> {
        try { publishIndex(site); }
        finally { latch.countDown(); }
    });

    // 并发发布所有栏目列表页
    for (Channel channel : channels) {
        publishExecutor.submit(() -> {
            try {
                int totalPages = calculateTotalPages(site, channel);
                for (int page = 1; page <= totalPages; page++) {
                    publishChannelList(site, channel, page);
                }
            } finally {
                latch.countDown();
            }
        });
    }

    // 并发发布所有内容详情页
    for (Content content : contents) {
        publishExecutor.submit(() -> {
            try { publishContentDetail(site, content); }
            finally { latch.countDown(); }
        });
    }

    try {
        // 等待所有发布任务完成（最多30分钟）
        latch.await(30, TimeUnit.MINUTES);
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        log.error("发布被中断");
    }
}
```

### 6.4 发布队列与异步处理

在用户触发发布操作时，发布任务进入队列异步执行，避免用户等待：

```java
@Component
public class PublishQueue {

    private final BlockingQueue<PublishTask> queue = new LinkedBlockingQueue<>(1000);
    private volatile boolean running = true;

    @PostConstruct
    public void init() {
        // 启动消费者线程
        new Thread(() -> {
            while (running) {
                try {
                    PublishTask task = queue.take(); // 阻塞获取
                    processTask(task);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }, "publish-consumer").start();
    }

    public void submit(PublishTask task) {
        boolean offered = queue.offer(task);
        if (!offered) {
            throw new BusinessException("发布队列已满，请稍后重试");
        }
        log.info("发布任务已加入队列: type={}, targetId={}",
                 task.getType(), task.getTargetId());
    }

    private void processTask(PublishTask task) {
        log.info("开始处理发布任务: type={}", task.getType());
        switch (task.getType()) {
            case FULL_PUBLISH:
                publishEngine.fullPublish(task.getSiteId());
                break;
            case CONTENT_PUBLISH:
                publishEngine.publishContent(
                    task.getSiteId(), task.getChannelId(), task.getContentId());
                break;
            case CHANNEL_PUBLISH:
                publishEngine.publishChannel(
                    task.getSiteId(), task.getChannelId());
                break;
        }
        log.info("发布任务完成: type={}", task.getType());
    }
}
```

### 6.5 发布目录结构

发布完成后，文件系统的目录结构：

```
/var/www/publish/
└── site_1/                        # 站点ID
    ├── index.html                 # 首页
    ├── about/
    │   └── index.html             # 关于我们（单页）
    ├── news/
    │   ├── index.html             # 新闻列表 第1页
    │   ├── index_2.html           # 新闻列表 第2页
    │   ├── index_3.html           # 新闻列表 第3页
    │   ├── 1001.html              # 新闻详情 ID=1001
    │   ├── 1002.html              # 新闻详情 ID=1002
    │   └── ...
    ├── products/
    │   ├── index.html
    │   ├── 2001.html
    │   └── ...
    ├── uploads/                   # 上传的文件
    │   ├── 2026/
    │   │   ├── 06/
    │   │   │   ├── abc123.jpg
    │   │   │   └── def456.pdf
    │   │   └── ...
    │   └── ...
    └── _resources/                # 全局资源
        ├── css/
        │   └── main.css
        ├── js/
        │   └── main.js
        └── images/
            └── logo.png
```

### 6.6 发布后的 URL 访问链路

以一个完整的访问为例，用户访问新闻详情页：

```
1. 用户浏览器输入: http://www.example.com/news/1001.html
       ↓
2. DNS 解析 → 服务器 IP
       ↓
3. Nginx 接收请求
       ↓
4. Nginx 检查: /var/www/publish/site_1/news/1001.html 是否存在
       ↓
5. 文件存在 → Nginx 直接返回静态文件（最高性能）
       ↓
6. 文件不存在 → Nginx 404
       ↓
7. (可选) Nginx 配置的 fallback → Tomcat 动态渲染
       location / {
           try_files $uri $uri/ @tomcat;
       }
       location @tomcat {
           proxy_pass http://127.0.0.1:8080;
       }
```

---

## 七、模板配置与前端渲染

### 7.1 模板配置流程

在博达后台配置模板的完整流程：

```
1. 进入"模板管理"模块
       ↓
2. 上传 .ftl 模板文件（或在线编辑）
       ↓
3. 配置模板参数：
   - 模板名称
   - 模板类型（首页/列表/详情/搜索/404）
   - 关联站点
   - 预览图
   - 模板变量说明
       ↓
4. 进入"栏目管理"
       ↓
5. 选择栏目 → 编辑
       ↓
6. 在"列表模板"字段选择刚上传的模板
       ↓
7. 在"详情模板"字段选择刚上传的模板
       ↓
8. 保存栏目配置
       ↓
9. 全量发布站点
       ↓
10. 前台访问验证
```

### 7.2 模板中调用资料库

模板中通过自定义指令调用资料库中的数据。核心逻辑已在 2.3 节说明，这里给出一个更完整的前台列表页模板示例：

```ftl
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${channel.name} - ${site.name}</title>
    <meta name="keywords" content="${channel.keywords!site.keywords!}">
    <meta name="description" content="${channel.description!site.description!}">
    <link rel="stylesheet" href="${site.contextPath}/_resources/css/main.css">
</head>
<body>
    <!-- 页头 -->
    <#include "/_common/header.ftl">

    <!-- 面包屑 -->
    <div class="breadcrumb">
        <a href="${site.contextPath}/">首页</a>
        <#list breadcrumb as crumb>
            &gt; <a href="${crumb.url}">${crumb.name}</a>
        </#list>
    </div>

    <!-- 内容区域 -->
    <div class="container">
        <div class="main">
            <h1 class="page-title">${channel.name}</h1>

            <#if contentList?size gt 0>
                <ul class="news-list">
                    <#list contentList as item>
                        <li>
                            <#if item.isTop>
                                <span class="tag top">置顶</span>
                            </#if>
                            <#if item.isRecommend>
                                <span class="tag rec">推荐</span>
                            </#if>
                            <#if item.isBold>
                                <h3 class="bold">
                            <#else>
                                <h3>
                            </#if>
                                <a href="${item.url}">${item.title}</a>
                            </h3>
                            <p class="meta">
                                ${item.author!""}
                                <#if item.author?? && item.source??> | </#if>
                                ${item.source!""}
                                <span class="date">${item.publishDate?string("yyyy-MM-dd")}</span>
                            </p>
                            <p class="summary">${item.summary!""}</p>
                        </li>
                    </#list>
                </ul>

                <!-- 分页 -->
                <#if totalPages gt 1>
                    <div class="pagination">
                        <#if pageNo gt 1>
                            <a href="${channel.urlPrefix!channel.url}${pageNo - 1}.html">上一页</a>
                        </#if>
                        <#list 1..totalPages as p>
                            <a href="${channel.urlPrefix!channel.url}${p}.html"
                               class="${(p == pageNo)?string('active', '')}">${p}</a>
                        </#list>
                        <#if pageNo lt totalPages>
                            <a href="${channel.urlPrefix!channel.url}${pageNo + 1}.html">下一页</a>
                        </#if>
                    </div>
                </#if>
            <#else>
                <div class="empty">
                    <p>暂无内容</p>
                </div>
            </#if>
        </div>

        <!-- 侧边栏 -->
        <div class="sidebar">
            <#include "/_common/sidebar.ftl">
        </div>
    </div>

    <!-- 页脚 -->
    <#include "/_common/footer.ftl">

    <script src="${site.contextPath}/_resources/js/main.js"></script>
</body>
</html>
```

### 7.3 详情页模板

```ftl
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${content.title} - ${channel.name} - ${site.name}</title>
    <meta name="keywords" content="${content.keywords!channel.keywords!site.keywords!}">
    <meta name="description" content="${content.summary!channel.description!site.description!}">
    <link rel="stylesheet" href="${site.contextPath}/_resources/css/main.css">
</head>
<body>
    <#include "/_common/header.ftl">

    <div class="breadcrumb">
        <a href="${site.contextPath}/">首页</a>
        <#list breadcrumb as crumb>
            &gt; <a href="${crumb.url}">${crumb.name}</a>
        </#list>
        &gt; <span class="current">正文</span>
    </div>

    <div class="container">
        <div class="main detail">
            <h1 class="detail-title">${content.title}</h1>

            <#if content.subTitle?? && content.subTitle != "">
                <h2 class="detail-subtitle">${content.subTitle}</h2>
            </#if>

            <div class="detail-meta">
                <span>作者：${content.author!"佚名"}</span>
                <span>来源：${content.source!"本站"}</span>
                <span>发布时间：${content.publishDate?string("yyyy-MM-dd HH:mm")}</span>
                <span>浏览：<span id="viewCount">${content.viewCount!0}</span></span>
            </div>

            <div class="detail-content">
                ${content.content?no_esc}
            </div>

            <#if attachments?size gt 0>
                <div class="detail-attachments">
                    <h3>附件下载</h3>
                    <ul>
                        <#list attachments as file>
                            <li>
                                <a href="${file.filePath}" download="${file.fileName}">
                                    ${file.fileName}
                                    (${(file.fileSize / 1024)?string("0.00")}KB)
                                </a>
                                <span class="download-count">
                                    已下载 ${file.downloadCount} 次
                                </span>
                            </li>
                        </#list>
                    </ul>
                </div>
            </#if>

            <!-- 上下篇导航 -->
            <div class="detail-nav">
                <div class="prev">
                    <#if prevContent??>
                        上一篇：<a href="${prevContent.url}">${prevContent.title}</a>
                    <#else>
                        上一篇：没有了
                    </#if>
                </div>
                <div class="next">
                    <#if nextContent??>
                        下一篇：<a href="${nextContent.url}">${nextContent.title}</a>
                    <#else>
                        下一篇：没有了
                    </#if>
                </div>
            </div>
        </div>

        <div class="sidebar">
            <#include "/_common/sidebar.ftl">
        </div>
    </div>

    <#include "/_common/footer.ftl">
    <script src="${site.contextPath}/_resources/js/main.js"></script>
</body>
</html>
```

### 7.4 多站点与模板继承

博达支持多站点共享模板，也支持模板继承。模板继承的实现思路：

```
基础模板（base.ftl）
  └── 站点A首页（index_A.ftl，继承 base.ftl）
  └── 站点B首页（index_B.ftl，继承 base.ftl）
```

FreeMarker 本身不支持模板继承（像 Jinja2 的 `extends`），博达通过两种方式实现：

**方式一：宏导入（推荐）**

```ftl
<#-- _common/base.ftl -->
<#macro pageLayout title keywords="" description="">
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${title} - ${site.name}</title>
    <meta name="keywords" content="${keywords}">
    <meta name="description" content="${description}">
    <link rel="stylesheet" href="${site.contextPath}/_resources/css/main.css">
</head>
<body>
    <#include "/_common/header.ftl">
    <div class="container">
        <#nested>  <#-- 子模板内容插入点 -->
    </div>
    <#include "/_common/footer.ftl">
</body>
</html>
</#macro>

<#-- index/index.ftl 使用宏 -->
<#import "/_common/base.ftl" as base>
<@base.pageLayout title="首页" keywords="网站关键词">
    <h1>欢迎访问${site.name}</h1>
    <!-- 首页特有内容 -->
</@base.pageLayout>
```

**方式二：页面片段包含**

```ftl
<#-- 每个页面的框架都一样，只是中间内容不同 -->
<#include "/_common/html_head.ftl">
<#include "/_common/header.ftl">
<#include "/_common/nav.ftl">

<div class="container">
    <!-- 各页面自己的内容 -->
    <#nested>  <#-- 这里在实际模板中替换为具体内容 -->
</div>

<#include "/_common/footer.ftl">
<#include "/_common/html_foot.ftl">
```

---

## 八、二次开发与扩展

### 8.1 自定义标签开发

如果你需要博达模板中获取自定义数据源的指令，可以实现自己的 `TemplateDirectiveModel`：

```java
@Component
public class CustomDataDirective implements TemplateDirectiveModel {

    @Override
    public void execute(Environment env, Map params, TemplateModel[] loopVars,
                        TemplateDirectiveBody body)
            throws TemplateException, IOException {

        // 1. 解析参数
        String type = getRequiredStringParam(params, "type");
        Integer limit = getIntParam(params, "limit", 10);

        // 2. 调用你的业务逻辑
        List<Map<String, Object>> dataList = yourBusinessService.getData(type, limit);

        // 3. 注入模板上下文
        DefaultObjectWrapper wrapper = new DefaultObjectWrapperBuilder(
            Configuration.VERSION_2_3_32).build();
        env.setVariable("dataList", wrapper.wrap(dataList));

        // 4. 渲染标签体
        if (body != null) {
            body.render(env.getOut());
        }
    }
}
```

在 FreeMarker 配置中注册：

```java
@Configuration
public class FreemarkerConfig {

    @Autowired
    private CustomDataDirective customDataDirective;

    @PostConstruct
    public void configureFreemarker() {
        Configuration cfg = FreeMarkerConfigurer.getConfiguration();
        cfg.setSharedVariable("custom", customDataDirective);
    }
}
```

然后在模板中就可以用了：

```ftl
<@custom type="notice" limit="5">
    <#list dataList as item>
        <li><a href="${item.url}">${item.title}</a></li>
    </#list>
</@custom>
```

### 8.2 自定义发布监听器

在发布流程中插入自定义逻辑（如：发布后推送通知、生成 PDF、刷新 CDN 缓存等）：

```java
@Component
public class CustomPublishListener implements ApplicationListener<PublishEvent> {

    @Override
    public void onApplicationEvent(PublishEvent event) {
        PublishType type = event.getType();
        Integer siteId = event.getSiteId();
        Integer contentId = event.getContentId();

        switch (type) {
            case CONTENT_PUBLISHED:
                // 内容发布后：生成 PDF 版本
                generatePdf(contentId);
                // 刷新 CDN 缓存
                refreshCdnCache("/content/" + contentId + ".html");
                break;
            case FULL_PUBLISH_COMPLETED:
                // 全量发布完成后：通知管理员
                notifyAdmin("全量发布完成");
                break;
        }
    }
}
```

### 8.3 集成 SSO 登录

博达通常通过 Filter 或 Spring Security 集成学校现有的统一身份认证系统：

```java
public class SsoAuthenticationFilter extends GenericFilterBean {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response,
                         FilterChain chain) throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpSession session = httpRequest.getSession(false);

        // 1. 检查 session 中是否有用户信息
        User user = (session != null)
            ? (User) session.getAttribute("_user")
            : null;

        if (user == null) {
            // 2. 检查 SSO Token（从请求头或 Cookie 中）
            String ssoToken = extractSsoToken(httpRequest);

            if (ssoToken != null) {
                // 3. 调用 SSO 接口验证 Token
                SsoResponse ssoResponse = ssoClient.validate(ssoToken);
                if (ssoResponse.isValid()) {
                    // 4. 查找或创建本地用户
                    user = userService.findOrCreate(ssoResponse.getUserId(),
                        ssoResponse.getUsername());
                    // 5. 写入 Session
                    if (session == null) {
                        session = httpRequest.getSession(true);
                    }
                    session.setAttribute("_user", user);
                }
            }
        }

        // 6. 将用户信息绑定到请求上下文
        if (user != null) {
            UserContextHolder.setUser(user);
        }

        try {
            chain.doFilter(request, response);
        } finally {
            UserContextHolder.clear();
        }
    }
}
```

### 8.4 自定义内容导入导出

博达通常支持通过 Excel 批量导入资料，也支持导出。以下是导出 Excel 的核心逻辑：

```java
public void exportContents(Integer siteId, Integer channelId, OutputStream os) {
    List<Content> contents = contentService.getContentsByChannel(siteId, channelId);

    // 使用 Apache POI 生成 Excel
    try (XSSFWorkbook workbook = new XSSFWorkbook()) {
        XSSFSheet sheet = workbook.createSheet("资料导出");

        // 表头
        String[] headers = {"ID", "标题", "作者", "发布时间", "状态", "浏览次数"};
        Row headerRow = sheet.createRow(0);
        for (int i = 0; i < headers.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
        }

        // 数据行
        int rowIdx = 1;
        for (Content content : contents) {
            Row row = sheet.createRow(rowIdx++);
            row.createCell(0).setCellValue(content.getId());
            row.createCell(1).setCellValue(content.getTitle());
            row.createCell(2).setCellValue(content.getAuthor());
            row.createCell(3).setCellValue(
                content.getPublishDate() != null
                    ? content.getPublishDate().toString() : "");
            row.createCell(4).setCellValue(content.getStatus());
            row.createCell(5).setCellValue(content.getViewCount());
        }

        workbook.write(os);
    } catch (IOException e) {
        throw new BusinessException("导出失败", e);
    }
}
```

---

## 九、常见问题与优化

### 9.1 性能优化

| 问题 | 原因 | 优化方案 |
|------|------|---------|
| 全量发布慢 | 渲染大量页面，单线程处理 | 使用线程池并发发布 |
| 前台访问慢 | 动态渲染未缓存 | Nginx 缓存 + 静态页面优先 |
| 栏目树加载慢 | 递归查询数据库 | 一次加载全量数据，内存中建树 |
| 模板修改不生效 | FreeMarker 缓存 | `setTemplateUpdateDelay` 调小或重启 |
| 大附件上传超时 | Tomcat 默认限制 | 修改 server.xml maxPostSize / maxSwallowSize |
| 搜索慢 | LIKE 全表扫描 | 使用全文索引或 Elasticsearch |
| Session 丢失 | Tomcat 重启 | 使用 Redis 托管 Session |

### 9.2 Nginx 配置优化

```nginx
server {
    listen 80;
    server_name www.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name www.example.com;

    ssl_certificate     /etc/nginx/ssl/example.com.pem;
    ssl_certificate_key /etc/nginx/ssl/example.com.key;

    # 发布目录根路径
    root /var/www/publish/site_1;

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # HTML 页面缓存（但不缓存管理后台）
    location ~* \.html$ {
        expires 5m;
        add_header Cache-Control "public, must-revalidate";
    }

    # 先尝试静态文件，不存在则转发到 Tomcat
    location / {
        try_files $uri $uri/ @tomcat;
    }

    # Tomcat 后端（用于动态渲染）
    location @tomcat {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 超时配置
        proxy_connect_timeout 60s;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }

    # 限制上传大小
    client_max_body_size 100M;

    # 访问日志
    access_log /var/log/nginx/example.com.access.log;
    error_log  /var/log/nginx/example.com.error.log;
}
```

### 9.3 Tomcat 配置优化

```xml
<!-- conf/server.xml -->
<Connector port="8080" protocol="HTTP/1.1"
           connectionTimeout="20000"
           redirectPort="8443"
           maxPostSize="104857600"
           maxSwallowSize="104857600"
           URIEncoding="UTF-8"
           compression="on"
           compressionMinSize="1024"
           compressableMimeType="text/html,text/xml,text/css,text/javascript,application/javascript"/>

<!-- conf/context.xml -->
<Context>
    <!-- 静态资源缓存 -->
    <Resources cachingAllowed="true" cacheMaxSize="102400" />
</Context>
```

---

## 十、总结

博达网站群管理平台的核心设计哲学可以概括为三句话：

1. **内容与展现分离**：资料库只存数据，模板只负责渲染，通过 FreeMarker 引擎在发布时合并
2. **静态优先**：发布引擎生成纯静态 HTML，Nginx 直接服务于用户，Tomcat 只做管理后台和动态渲染
3. **站点群统一管理**：一套后台管理多站点，站点间栏目、模板、资料隔离，通过域名解析分发

理解这套机制后，大部分开发场景都能应对：

- **改样式** → 编辑 .ftl 模板文件，修改 HTML 结构和 CSS
- **加功能** → 开发自定义 FreeMarker 指令，在模板中调用
- **改流程** → 修改 Java Service 层或发布引擎
- **做集成** → 通过 Filter、Listener、API 对接外部系统

博达的架构虽然年代较早（基于 Servlet + JSP + FreeMarker），但"静态化发布"这个设计理念在今天来看仍然是正确的——静态页面的性能和安全性是动态页面无法比拟的。理解它的内部逻辑，不只是为了维护一个 CMS，更是为了理解"内容管理"这个领域最基本的问题：**如何高效地把数据变成用户可以访问的页面**。
