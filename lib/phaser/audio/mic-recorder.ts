export interface MicRecorderOptions {
	sampleRate?: number;
	samplesPerChunk?: number;
	onChunk?: (chunk: Float32Array) => void;
}

export class MicRecorder {
	private readonly sampleRate: number;
	private readonly samplesPerChunk: number;
	private readonly onChunk?: (chunk: Float32Array) => void;
	private audioContext: AudioContext | null = null;
	private stream: MediaStream | null = null;
	private source: MediaStreamAudioSourceNode | null = null;
	private processor: AudioWorkletNode | null = null;
	private recording = false;
	private chunks: Float32Array[] = [];

	constructor({ sampleRate = 16_000, samplesPerChunk = 1_024, onChunk }: MicRecorderOptions = {}) {
		this.sampleRate = sampleRate;
		this.samplesPerChunk = samplesPerChunk;
		this.onChunk = onChunk;
	}

	get isRecording() {
		return this.recording;
	}

	get recordedChunks() {
		return this.chunks;
	}

	get recordedSampleCount() {
		return this.chunks.reduce((total, chunk) => total + chunk.length, 0);
	}

	get peakAmplitude() {
		return this.chunks.reduce(
			(peak, chunk) => Math.max(peak, ...chunk.map((sample) => Math.abs(sample))),
			0,
		);
	}

	async requestPermission() {
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		stream.getTracks().forEach((track) => track.stop());
	}

	async start() {
		if (this.recording) {
			return;
		}

		this.recording = true;
		this.chunks = [];

		try {
			this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			if (!this.recording) {
				this.stream.getTracks().forEach((track) => track.stop());
				this.stream = null;
				return;
			}

			this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
			await this.audioContext.audioWorklet.addModule("/audio-worklet/mic-processor.js");
			if (!this.recording) {
				await this.stop();
				return;
			}

			this.source = this.audioContext.createMediaStreamSource(this.stream);
			this.processor = new AudioWorkletNode(this.audioContext, "mic-processor", {
				channelCount: 1,
				processorOptions: {
					targetSampleRate: this.sampleRate,
					samplesPerChunk: this.samplesPerChunk,
				},
			});

			this.processor.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
				const chunk = new Float32Array(event.data);
				this.chunks.push(chunk);
				this.onChunk?.(chunk);
			};

			this.source.connect(this.processor);
			this.processor.connect(this.audioContext.destination);
		} catch (error) {
			await this.stop();
			throw error;
		}
	}

	async stop() {
		this.processor?.port.close();
		this.processor?.disconnect();
		this.processor = null;
		this.source?.disconnect();
		this.source = null;
		this.stream?.getTracks().forEach((track) => track.stop());
		this.stream = null;
		const audioContext = this.audioContext;
		this.audioContext = null;
		this.recording = false;
		await audioContext?.close();
	}

	reset() {
		this.chunks = [];
	}

	toWav() {
		const sampleCount = this.chunks.reduce((total, chunk) => total + chunk.length, 0);
		const buffer = new ArrayBuffer(44 + sampleCount * 2);
		const view = new DataView(buffer);
		const writeString = (offset: number, value: string) => {
			for (let index = 0; index < value.length; index += 1) {
				view.setUint8(offset + index, value.charCodeAt(index));
			}
		};

		writeString(0, "RIFF");
		view.setUint32(4, 36 + sampleCount * 2, true);
		writeString(8, "WAVE");
		writeString(12, "fmt ");
		view.setUint32(16, 16, true);
		view.setUint16(20, 1, true);
		view.setUint16(22, 1, true);
		view.setUint32(24, this.sampleRate, true);
		view.setUint32(28, this.sampleRate * 2, true);
		view.setUint16(32, 2, true);
		view.setUint16(34, 16, true);
		writeString(36, "data");
		view.setUint32(40, sampleCount * 2, true);

		let offset = 44;
		for (const chunk of this.chunks) {
			for (const sample of chunk) {
				const value = Math.max(-1, Math.min(1, sample));
				view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
				offset += 2;
			}
		}

		return new Blob([buffer], { type: "audio/wav" });
	}
}
