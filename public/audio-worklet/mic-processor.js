class MicProcessor extends AudioWorkletProcessor {
	constructor({ processorOptions }) {
		super();
		this.sampleRate = processorOptions.targetSampleRate;
		this.samplesPerChunk = processorOptions.samplesPerChunk;
		this.pending = [];
	}

	process(inputs) {
		const input = inputs[0]?.[0];
		if (!input) {
			return true;
		}

		const ratio = sampleRate / this.sampleRate;
		for (let index = 0; index < input.length; index += 1) {
			const sourceIndex = index * ratio;
			const lowerIndex = Math.floor(sourceIndex);
			const upperIndex = Math.min(lowerIndex + 1, input.length - 1);
			const weight = sourceIndex - lowerIndex;
			this.pending.push(input[lowerIndex] * (1 - weight) + input[upperIndex] * weight);
		}

		while (this.pending.length >= this.samplesPerChunk) {
			const chunk = new Float32Array(this.pending.splice(0, this.samplesPerChunk));
			this.port.postMessage(chunk, [chunk.buffer]);
		}

		return true;
	}
}

registerProcessor("mic-processor", MicProcessor);
