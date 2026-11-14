/**
 * Puente seguro entre la interfaz y el sistema. La interfaz NO tiene acceso
 * a Node.js; solo a estas funciones concretas.
 */
const { contextBridge, ipcRenderer } = require('electron');

const escuchar = (canal) => (fn) => {
  const manejador = (_e, datos) => fn(datos);
  ipcRenderer.on(canal, manejador);
  return () => ipcRenderer.removeListener(canal, manejador);
};

contextBridge.exposeInMainWorld('qb', {
  config: {
    leer: () => ipcRenderer.invoke('config:leer'),
    guardar: (datos) => ipcRenderer.invoke('config:guardar', datos),
  },
  demo: {
    login: (email, password) => ipcRenderer.invoke('demo:login', { email, password }),
    logout: () => ipcRenderer.invoke('demo:logout'),
    sesion: () => ipcRenderer.invoke('demo:sesion'),
    rpc: (nombre, args) => ipcRenderer.invoke('demo:rpc', { nombre, args }),
    simularPedidoWeb: () => ipcRenderer.invoke('demo:simular-pedido-web'),
    alCambiarPedidos: escuchar('demo:cambio-pedidos'),
  },
  pdf: { reporte: (datos) => ipcRenderer.invoke('pdf:reporte', datos) },
  comanda: { imprimir: (datos) => ipcRenderer.invoke('comanda:imprimir', datos) },
  abrirExterno: (url) => ipcRenderer.invoke('app:abrir-externo', url),
  notificar: (titulo, cuerpo) => ipcRenderer.invoke('app:notificar', { titulo, cuerpo }),
  recargar: () => ipcRenderer.invoke('app:recargar'),
  actualizador: {
    estado: () => ipcRenderer.invoke('updater:estado'),
    buscar: () => ipcRenderer.invoke('updater:buscar'),
    instalar: () => ipcRenderer.invoke('updater:instalar'),
    alCambiar: escuchar('updater:estado'),
  },
});
