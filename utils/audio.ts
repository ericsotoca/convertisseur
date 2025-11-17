
export function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

export async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

export function concatAudioBuffers(buffers: AudioBuffer[], context: AudioContext): AudioBuffer {
    if (buffers.length === 0) return context.createBuffer(1, 1, context.sampleRate);
    if (buffers.length === 1) return buffers[0];

    const totalLength = buffers.reduce((acc, buffer) => acc + buffer.length, 0);
    const numberOfChannels = buffers[0].numberOfChannels;
    const sampleRate = buffers[0].sampleRate;
    
    const result = context.createBuffer(numberOfChannels, totalLength, sampleRate);

    for (let channel = 0; channel < numberOfChannels; channel++) {
        const channelData = result.getChannelData(channel);
        let offset = 0;
        for (const buffer of buffers) {
            channelData.set(buffer.getChannelData(channel), offset);
            offset += buffer.length;
        }
    }
    return result;
}

// https://docs.fileformat.com/audio/wav/
// Utility to convert an AudioBuffer to a WAV file Blob
export function bufferToWav(buffer: AudioBuffer): Blob {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferView = new DataView(new ArrayBuffer(length));
    const channels = [];
    let i, sample;
    let offset = 0;
    let pos = 0;

    // Helper function to write strings
    const writeString = (view: DataView, offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    // RIFF header
    writeString(bufferView, pos, 'RIFF'); pos += 4;
    bufferView.setUint32(pos, length - 8, true); pos += 4;
    writeString(bufferView, pos, 'WAVE'); pos += 4;

    // FMT sub-chunk
    writeString(bufferView, pos, 'fmt '); pos += 4;
    bufferView.setUint32(pos, 16, true); pos += 4; // Sub-chunk size
    bufferView.setUint16(pos, 1, true); pos += 2; // Audio format (1 = PCM)
    bufferView.setUint16(pos, numOfChan, true); pos += 2;
    bufferView.setUint32(pos, buffer.sampleRate, true); pos += 4;
    bufferView.setUint32(pos, buffer.sampleRate * 2 * numOfChan, true); pos += 4; // Byte rate
    bufferView.setUint16(pos, numOfChan * 2, true); pos += 2; // Block align
    bufferView.setUint16(pos, 16, true); pos += 2; // Bits per sample

    // DATA sub-chunk
    writeString(bufferView, pos, 'data'); pos += 4;
    bufferView.setUint32(pos, length - pos - 4, true); pos += 4;

    // Write the PCM samples
    for (i = 0; i < buffer.numberOfChannels; i++) {
        channels.push(buffer.getChannelData(i));
    }

    while (pos < length) {
        for (i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset])); // Clamp
            sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF) | 0; // Convert to 16-bit signed int
            bufferView.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++;
    }

    return new Blob([bufferView], { type: 'audio/wav' });
}
