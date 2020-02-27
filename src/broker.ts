import { Logger } from 'pino';
import { ApiRoot } from 'kubernetes-client';
import { sync } from 'glob';
import { createLogger, createClient } from './utils';
import { Controller } from './controller';

export class OperatorBroker {
  protected baseLogger: Logger;
  protected logger: Logger;
  protected client: ApiRoot;
  protected initialized = false;
  protected started = false;

  protected controllers: Controller[] = [];

  public constructor(private name: string) {
    this.baseLogger = createLogger(this.name);
    this.logger = this.baseLogger.child({ caller: 'broker' });
  }

  public async init(): Promise<void> {
    if (this.initialized) {
      const err = new Error('Broker already initialized');
      this.logger.error(err);
      throw err;
    }

    this.logger.info('Initializing broker');
    this.client = await createClient(this.logger);
    this.logger.info('Initializing controllers');

    for (const ctrl of this.controllers) {
      await ctrl.init();
    }

    this.logger.info('Controllers initialized');
    this.logger.info('Broker initialized');
  }

  public async start(): Promise<void> {
    if (this.started) {
      const err = new Error('Broker already started');
      this.logger.error(err);
      throw err;
    }

    if (!this.initialized) {
      await this.init();
    }
    this.logger.info('Starting broker');
    this.logger.info('Starting controllers');

    for (const ctrl of this.controllers) {
      await ctrl.start();
    }

    this.logger.info('Controllers started');
    this.logger.info('Broker started');
  }

  public async stop(passWithoutError = false): Promise<void> {
    if (!this.started && !passWithoutError) {
      const err = new Error('Broker not started');
      this.logger.error(err);
      throw err;
    } else if (!this.started && passWithoutError) {
      return;
    }

    this.logger.info('Stopping broker');
    this.logger.info('Stopping controllers');

    for (const ctrl of this.controllers) {
      await ctrl.stop();
    }

    this.logger.info('Controllers stopped');
    this.logger.info('Broker stopped');
  }

  public loadControllers(glob: string): number {
    this.logger.info(`Loading controllers with glob ${glob}`);

    const paths = sync(glob);

    for (const path of paths) {
      this.loadController(path);
    }
    return paths.length;
  }

  public loadController(path: string): Controller {
    this.logger.info(`Loading controller from ${path}`);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ctrl: Controller = require(path).default;
    if (!ctrl) {
      const err = new Error(`Unable to load controller from ${path}`);
      this.logger.error(err);
      throw err;
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    const instance = new ctrl(this);
    this.logger.info(`Successfully loaded controller(${ctrl.name}) from ${path}`);

    this.controllers.push(instance);

    return instance;
  }

  public getLogger(): Logger {
    return this.logger;
  }

  public getClient(): ApiRoot {
    return this.client;
  }
}
