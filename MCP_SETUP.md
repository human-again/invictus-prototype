# MCP Server Configuration Guide

This guide explains how to set up Model Context Protocol (MCP) servers for Render and GitHub integration in Cursor.

## Overview

MCP servers allow Cursor to interact with external services like Render (for real-time log monitoring) and GitHub (for repository management and debugging).

## Prerequisites

- Cursor IDE installed
- Render account with API access
- GitHub account with appropriate permissions

## Configuration Location

MCP servers are configured in Cursor's settings. The configuration file is typically located at:
- **macOS**: `~/Library/Application Support/Cursor/User/globalStorage/mcp.json` or in Cursor Settings
- **Windows**: `%APPDATA%\Cursor\User\globalStorage\mcp.json`
- **Linux**: `~/.config/Cursor/User/globalStorage/mcp.json`

Alternatively, configure through Cursor Settings UI:
1. Open Cursor Settings (Cmd/Ctrl + ,)
2. Search for "MCP" or "Model Context Protocol"
3. Add server configurations

## Render MCP Server Setup

### Purpose
Monitor Render deployment logs in real-time, view service status, and debug deployment issues.

### Configuration

Add the following to your MCP configuration:

```json
{
  "mcpServers": {
    "render": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-render"
      ],
      "env": {
        "RENDER_API_KEY": "your_render_api_key_here"
      }
    }
  }
}
```

### Getting Your Render API Key

1. Log in to [Render Dashboard](https://dashboard.render.com)
2. Go to **Account Settings** → **API Keys**
3. Click **Create API Key**
4. Copy the API key and add it to the configuration above

### Features Available

- View real-time service logs
- Monitor deployment status
- Check service health
- View build logs
- Manage environment variables
- Restart services

### Usage Examples

Once configured, you can use commands like:
- "Show me the latest Render logs"
- "What's the status of my Render deployment?"
- "Stream the logs from my backend service"

## GitHub MCP Server Setup

### Purpose
Integrate GitHub functionality for repository management, issue tracking, and code review.

### Configuration

Add the following to your MCP configuration:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your_github_token_here"
      }
    }
  }
}
```

### Getting Your GitHub Personal Access Token

1. Go to [GitHub Settings](https://github.com/settings/tokens)
2. Click **Developer settings** → **Personal access tokens** → **Tokens (classic)**
3. Click **Generate new token (classic)**
4. Give it a name (e.g., "Cursor MCP")
5. Select scopes:
   - `repo` (full control of private repositories)
   - `read:org` (read org membership)
   - `read:user` (read user profile)
6. Click **Generate token**
7. Copy the token immediately (you won't see it again)
8. Add it to the configuration above

### Features Available

- View repository information
- Read and create issues
- View pull requests
- Access file contents
- Search repositories
- View commit history
- Manage branches

### Usage Examples

Once configured, you can use commands like:
- "Show me the latest issues in this repository"
- "Create a new issue for the deployment bug"
- "What are the recent commits?"
- "Show me the diff for the last commit"

## Complete Configuration Example

Here's a complete MCP configuration with both servers:

```json
{
  "mcpServers": {
    "render": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-render"
      ],
      "env": {
        "RENDER_API_KEY": "rnd_your_render_api_key_here"
      }
    },
    "github": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_github_token_here"
      }
    }
  }
}
```

## Alternative: Using Environment Variables

Instead of hardcoding API keys in the configuration, you can use environment variables:

```json
{
  "mcpServers": {
    "render": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-render"
      ],
      "env": {
        "RENDER_API_KEY": "${RENDER_API_KEY}"
      }
    },
    "github": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

Then set the environment variables in your shell:
```bash
export RENDER_API_KEY="your_key"
export GITHUB_TOKEN="your_token"
```

## Verification

After configuring, restart Cursor and verify the MCP servers are connected:

1. Open Cursor Command Palette (Cmd/Ctrl + Shift + P)
2. Search for "MCP" or check the status bar
3. You should see indicators that the servers are connected

## Troubleshooting

### Render MCP Issues

- **"API key invalid"**: Verify your API key in Render dashboard
- **"Cannot connect"**: Check your internet connection and Render service status
- **"Permission denied"**: Ensure your API key has the necessary permissions

### GitHub MCP Issues

- **"Token expired"**: Generate a new personal access token
- **"Insufficient permissions"**: Ensure your token has the required scopes
- **"Rate limit exceeded"**: Wait a few minutes and try again

### General Issues

- **Servers not loading**: Check the configuration JSON syntax
- **Command not found**: Ensure Node.js and npm are installed
- **Connection timeout**: Check firewall settings

## Security Best Practices

1. **Never commit API keys** to version control
2. **Use environment variables** for sensitive data
3. **Rotate tokens regularly** (every 90 days recommended)
4. **Use minimal scopes** for GitHub tokens (only what's needed)
5. **Store configuration securely** (consider using a secrets manager)

## Additional Resources

- [MCP Documentation](https://modelcontextprotocol.io)
- [Render API Documentation](https://render.com/docs/api)
- [GitHub API Documentation](https://docs.github.com/en/rest)
- [Cursor MCP Guide](https://cursor.sh/docs/mcp)

## Next Steps

After setting up MCP servers:

1. Test Render integration by asking Cursor to show deployment logs
2. Test GitHub integration by asking Cursor to show repository information
3. Use MCP features to debug deployment issues in real-time
4. Integrate GitHub workflows for automated deployments

