import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { TuyaThermostatAccessory } from './platformAccessory';

interface DeviceConfig {
  name: string;
  id: string;
  key: string;
  disableAfterSeconds?: number;
}

export interface Device extends DeviceConfig {
  uuid: string;
  state: boolean;
  isWarming: boolean;
  currentTemp: number;
  targetTemp: number;
  heatingSince?: number;
}

export class TuyaHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices() {
    const configDevices: DeviceConfig[] = this?.config?.devices;

    const devices = configDevices.map(cd => <Device>{
      ...cd,
      uuid: this.api.hap.uuid.generate(cd.id),
    });

    for (const device of devices) {
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === device.uuid);

      if (existingAccessory) {
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

        new TuyaThermostatAccessory(this, existingAccessory);
        continue;
      }

      this.log.info('Adding new accessory:', device.name);

      const accessory = new this.api.platformAccessory(device.name, device.uuid);

      accessory.context.device = device;

      new TuyaThermostatAccessory(this, accessory);

      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }
  }
}
