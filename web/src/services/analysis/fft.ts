// FFT for Beat This! mel spectrogram (from Folia automix/signalAnalysis.ts).

const bitReversal = new Map<number, Uint32Array>();

const bitReversalOf = (n: number): Uint32Array => {
    let found = bitReversal.get(n);
    if (found) return found;
    const table = new Uint32Array(n);
    const bits = Math.log2(n);
    for (let i = 0; i < n; i += 1) {
        let j = 0;
        for (let bit = 0; bit < bits; bit += 1) j = (j << 1) | ((i >> bit) & 1);
        table[i] = j;
    }
    bitReversal.set(n, table);
    return table;
};

export const fft = (real: Float64Array, imag: Float64Array) => {
    const n = real.length;
    const reversed = bitReversalOf(n);
    for (let i = 1; i < n; i += 1) {
        const j = reversed[i];
        if (i < j) {
            let swap = real[i];
            real[i] = real[j];
            real[j] = swap;
            swap = imag[i];
            imag[i] = imag[j];
            imag[j] = swap;
        }
    }
    for (let len = 2; len <= n; len <<= 1) {
        const angle = (-2 * Math.PI) / len;
        const wReal = Math.cos(angle);
        const wImag = Math.sin(angle);
        for (let i = 0; i < n; i += len) {
            let curReal = 1;
            let curImag = 0;
            for (let k = 0; k < len / 2; k += 1) {
                const aReal = real[i + k];
                const aImag = imag[i + k];
                const bReal = real[i + k + len / 2] * curReal - imag[i + k + len / 2] * curImag;
                const bImag = real[i + k + len / 2] * curImag + imag[i + k + len / 2] * curReal;
                real[i + k] = aReal + bReal;
                imag[i + k] = aImag + bImag;
                real[i + k + len / 2] = aReal - bReal;
                imag[i + k + len / 2] = aImag - bImag;
                const nextReal = curReal * wReal - curImag * wImag;
                curImag = curReal * wImag + curImag * wReal;
                curReal = nextReal;
            }
        }
    }
};
