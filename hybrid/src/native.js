import { BleClient } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';

const SERVICE = '0000ff00-0000-1000-8000-00805f9b34fb';
const DEVICE_KEY = 'eb3a-capacitor-last-device';
let initialized;
const initialize = () => initialized ||= BleClient.initialize();

class NativeCharacteristic extends EventTarget {
  constructor(device, uuid) { super(); this.device=device; this.uuid=uuid; this.value=null; }
  async startNotifications() {
    await BleClient.startNotifications(this.device.id, SERVICE, this.uuid, value => {
      this.value=value;
      this.dispatchEvent(new Event('characteristicvaluechanged'));
    });
    return this;
  }
  async writeValueWithoutResponse(value) {
    const v=value instanceof DataView ? value : new DataView(value.buffer,value.byteOffset,value.byteLength);
    await BleClient.writeWithoutResponse(this.device.id,SERVICE,this.uuid,v);
  }
  async writeValue(value) {
    const v=value instanceof DataView ? value : new DataView(value.buffer,value.byteOffset,value.byteLength);
    await BleClient.write(this.device.id,SERVICE,this.uuid,v);
  }
}

class NativeDevice extends EventTarget {
  constructor(data) {
    super();
    this.id=data.deviceId;
    this.name=data.name || 'EB3A';
    this.connected=false;
    this.gatt={
      get connected() { return this.owner.connected; },
      owner:this,
      connect:async () => {
        await initialize();
        await BleClient.connect(this.id, () => {
          this.connected=false;
          this.dispatchEvent(new Event('gattserverdisconnected'));
        });
        this.connected=true;
        return this.gatt;
      },
      disconnect: () => {
        if (!this.connected) return;
        this.connected=false;
        BleClient.disconnect(this.id).catch(console.error);
        this.dispatchEvent(new Event('gattserverdisconnected'));
      },
      getPrimaryService: async uuid => {
        if (uuid.toLowerCase()!==SERVICE) throw new Error('Непідтримуваний BLE-сервіс');
        return {
          getCharacteristic: async characteristicUuid => {
            if (!['0000ff01-0000-1000-8000-00805f9b34fb','0000ff02-0000-1000-8000-00805f9b34fb'].includes(characteristicUuid.toLowerCase())) throw new Error('Непідтримувана характеристика');
            return new NativeCharacteristic(this,characteristicUuid);
          }
        };
      }
    };
  }
}

const cache = new Map();
function wrap(device) {
  if (!cache.has(device.deviceId)) cache.set(device.deviceId,new NativeDevice(device));
  return cache.get(device.deviceId);
}
async function previouslySelected() {
  const id=localStorage.getItem(DEVICE_KEY);
  if (!id) return [];
  try {
    await initialize();
    return (await BleClient.getDevices([id])).map(wrap);
  } catch (e) { console.warn('Stored device unavailable',e); return []; }
}

if(Capacitor.isNativePlatform()) {
  window.eb3aBluetooth={
    async requestDevice() {
      await initialize();
      // The native plugin exposes ONE namePrefix rather than a list of Web Bluetooth filters.
      // An unfiltered chooser allows both EB3A and BLUETTI advertising names.
      const device=await BleClient.requestDevice({optionalServices:[SERVICE],displayMode:'list'});
      localStorage.setItem(DEVICE_KEY,device.deviceId);
      return wrap(device);
    },
    getDevices:previouslySelected
  };
} else {
  window.eb3aBluetooth = navigator.bluetooth;
}
