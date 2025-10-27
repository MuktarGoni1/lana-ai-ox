#!/usr/bin/env node

const { spawn } = require('child_process');
const os = require('os');

// Function to get local network IP
function getNetworkIP() {
  const interfaces = os.networkInterfaces();
  
  // Priority order: Wi-Fi, Ethernet, then others
  const priorityOrder = ['Wi-Fi', 'Ethernet', 'en0', 'eth0', 'wlan0', '以太网'];
  
  // First try priority interfaces
  for (const priority of priorityOrder) {
    if (interfaces[priority]) {
      for (const iface of interfaces[priority]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          // Prefer non-link-local addresses (not 169.254.x.x)
          if (!iface.address.startsWith('169.254.')) {
            return iface.address;
          }
        }
      }
    }
  }
  
  // Fallback: any non-internal, non-link-local IPv4
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    
    for (const details of iface) {
      if (details.family === 'IPv4' && !details.internal && !details.address.startsWith('169.254.')) {
        return details.address;
      }
    }
  }
  
  // Last resort: try to detect via hostname (Windows-specific)
  try {
    const { networkInterfaces: netIfaces } = os;
    const allInterfaces = netIfaces();
    
    // Look for any valid IPv4 that's not localhost or link-local
    for (const [name, addresses] of Object.entries(allInterfaces)) {
      if (!addresses) continue;
      
      for (const addr of addresses) {
        if (
          addr.family === 'IPv4' &&
          !addr.internal &&
          !addr.address.startsWith('169.254.') &&
          !addr.address.startsWith('127.')
        ) {
          return addr.address;
        }
      }
    }
  } catch (e) {
    console.error('Error detecting network IP:', e.message);
  }
  
  return null;
}

const localIP = getNetworkIP();
const port = process.env.PORT || 3000;

console.log('\n🚀 Starting LANA AI Frontend Development Server...\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📱 Local:    http://localhost:${port}`);

if (localIP && localIP !== 'localhost') {
  console.log(`🌐 Network:  http://${localIP}:${port}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`✅ Access from other devices on your network using:`);
  console.log(`   http://${localIP}:${port}`);
  console.log(`\n⚠️  Note: Your browser may show http://0.0.0.0:${port}`);
  console.log(`   Ignore that and use http://${localIP}:${port} instead!\n`);
} else {
  console.log(`🌐 Network:  http://192.168.0.187:${port} (use this!)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`⚠️  Auto-detection failed. Manually using: 192.168.0.187`);
  console.log(`   If your IP is different, check with: ipconfig`);
  console.log(`   Then use: http://YOUR_IP:${port}\n`);
}

// Start Next.js dev server
const next = spawn('next', ['dev', '-H', '0.0.0.0', '-p', port.toString()], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env }
});

next.on('close', (code) => {
  console.log(`\n👋 Development server stopped with code ${code}`);
  process.exit(code);
});

// Handle termination signals
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down development server...');
  next.kill('SIGINT');
});

process.on('SIGTERM', () => {
  next.kill('SIGTERM');
});
