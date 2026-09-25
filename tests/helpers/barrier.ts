export class Barrier {
  private waiting = 0;
  private releasePromise: Promise<void>;
  private release!: () => void;

  constructor(private readonly parties: number) {
    this.releasePromise = new Promise(resolve => { this.release = resolve; });
  }

  async arrive(): Promise<void> {
    this.waiting += 1;
    if (this.waiting === this.parties) this.release();
    await this.releasePromise;
  }
}
