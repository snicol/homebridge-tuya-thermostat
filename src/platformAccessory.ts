import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { Device, TuyaHomebridgePlatform } from './platform';

import TuyAPI from 'tuyapi';

export class TuyaThermostatAccessory {
  private service: Service;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;
  private device: Device;

  constructor(
    private readonly platform: TuyaHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.device = accessory.context.device as Device;

    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Tuya')
      .setCharacteristic(this.platform.Characteristic.Model, 'ProWarm Wi-Fi')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.device.id);

    this.service = this.accessory.getService(this.platform.Service.Thermostat)
      || this.accessory.addService(this.platform.Service.Thermostat);

    this.client = new TuyAPI({
      id: this.device.id,
      key: this.device.key,
      issueGetOnConnect: true,
    });

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.device.name);

    this.service.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
      .onGet(this.getCurrentHeatingCoolingState.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .onGet(this.getTargetHeatingCoolingState.bind(this))
      .onSet(this.setTargetHeatingCoolingState.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .onGet(this.getTargetTemperature.bind(this))
      .onSet(this.setTargetTemperature.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
      .onGet(this.getTemperatureDisplayUnits.bind(this))
      .onSet(this.setTemperatureDisplayUnits.bind(this));

    this.client.on('data', data => {
      this.device.state = data.dps['101'];
      this.device.isWarming = data.dps['118'] === 'heating' ? true : false;
      this.device.targetTemp = Math.max(100, data.dps['102']);
      this.device.currentTemp = Math.max(100, data.dps['106']);

      this.platform.log.debug('device synced', { dev: this.device });
    });

    // Assume we'll get kicked off or have to sync manual changes on the thermostat
    setInterval(async () => {
      try {
        await this.client.find();
        await this.client.connect();
        await this.client.get();
      } catch (error) {
        this.platform.log.error('error in device reconnect attempt', { error });
      }
    }, 5000);
  }

  async getCurrentHeatingCoolingState(): Promise<CharacteristicValue> {
    if (this.device.isWarming) {
      return this.platform.Characteristic.TargetHeatingCoolingState.HEAT;
    }

    return this.platform.Characteristic.TargetHeatingCoolingState.OFF;
  }

  async getTargetHeatingCoolingState(): Promise<CharacteristicValue> {
    if (this.device.state) {
      return this.platform.Characteristic.CurrentHeatingCoolingState.HEAT;
    }

    return this.platform.Characteristic.CurrentHeatingCoolingState.OFF;
  }

  async setTargetHeatingCoolingState(value: CharacteristicValue) {
    if (value === this.platform.Characteristic.CurrentHeatingCoolingState.HEAT) {
      await this.client.set({dps: 101, set: true});
      return;
    }

    await this.client.set({dps: 101, set: false});
  }

  async getCurrentTemperature(): Promise<CharacteristicValue> {
    if (!this.device.currentTemp) {
      return 10;
    }

    return (this.device.currentTemp / 10);
  }

  async getTargetTemperature(): Promise<CharacteristicValue> {
    if (!this.device.targetTemp) {
      return 10;
    }

    return (this.device.targetTemp / 10);
  }

  async setTargetTemperature(value: CharacteristicValue) {
    const convertedTemp = (value as number) * 10;

    await this.client.set({dps: 102, set: convertedTemp});
  }

  async getTemperatureDisplayUnits(): Promise<CharacteristicValue> {
    return this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS;
  }

  // NOTE(snicol): I have no intention to use farenheit
  async setTemperatureDisplayUnits(value: CharacteristicValue) {
    this.platform.log.debug('setTemperatureDisplayUnits ->', value);
  }
}
