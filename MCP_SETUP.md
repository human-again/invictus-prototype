# MCP Server Configuration Guide

This guide explains how to set up Model Context Protocol (MCP) servers for Railway and GitHub integration in Cursor.

## Overview

MCP servers allow Cursor to interact with external services like Railway (for deployment management) and GitHub (for repository management and debugging).

## Prerequisites

- Cursor IDE installed
- Railway account with API access (optional)
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

## Railway MCP Server Setup (Optional)

### Purpose
Monitor Railway deployments, view service status, and manage deployments through Cursor.

### Configuration

Railway MCP integration can be configured if you have Railway API access. Check Railway documentation for MCP server availability.

For now, Railway deployments are best managed through:
- Railway Dashboard: https://railway.app
- Railway CLI: https://docs.railway.app/develop/cli

**Note**: After configuring, you'll need to:
1. Restart Cursor for the MCP server to connect
2. Railway MCP integration may require Railway API access - check Railway documentation for current MCP support

### Features Available (if Railway MCP is available)

- View real-time service logs
- Monitor deployment status
- Check service health
- View build logs
- Manage environment variables
- Restart services

### Usage Examples (if Railway MCP is available)

Once configured, you can use commands like:
- "Show me the latest Railway logs"
- "What's the status of my Railway deployment?"
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

Here's a complete MCP configuration with GitHub server:

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
export GITHUB_TOKEN="your_token"
```

## Verification

After configuring, restart Cursor and verify the MCP servers are connected:

1. Open Cursor Command Palette (Cmd/Ctrl + Shift + P)
2. Search for "MCP" or check the status bar
3. You should see indicators that the servers are connected

## Troubleshooting

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
- [Railway Documentation](https://docs.railway.app)
- [GitHub API Documentation](https://docs.github.com/en/rest)
- [Cursor MCP Guide](https://cursor.sh/docs/mcp)

## Next Steps

After setting up MCP servers:

1. Test GitHub integration by asking Cursor to show repository information
2. Use MCP features to manage GitHub repositories and issues
3. Integrate GitHub workflows for automated deployments
4. Monitor Railway deployments through Railway Dashboard or CLI

