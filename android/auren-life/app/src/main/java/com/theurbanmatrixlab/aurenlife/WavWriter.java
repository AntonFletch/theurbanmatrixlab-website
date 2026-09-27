package com.theurbanmatrixlab.aurenlife;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

public final class WavWriter {
    private WavWriter() {}

    public static void writeMono16(File file, byte[] pcm, int sampleRate) throws IOException {
        int channels = 1;
        int bitsPerSample = 16;
        int byteRate = sampleRate * channels * bitsPerSample / 8;
        int dataSize = pcm.length;
        int chunkSize = 36 + dataSize;

        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(new byte[]{'R','I','F','F'});
            writeIntLE(out, chunkSize);
            out.write(new byte[]{'W','A','V','E'});
            out.write(new byte[]{'f','m','t',' '});
            writeIntLE(out, 16);
            writeShortLE(out, (short) 1);
            writeShortLE(out, (short) channels);
            writeIntLE(out, sampleRate);
            writeIntLE(out, byteRate);
            writeShortLE(out, (short) (channels * bitsPerSample / 8));
            writeShortLE(out, (short) bitsPerSample);
            out.write(new byte[]{'d','a','t','a'});
            writeIntLE(out, dataSize);
            out.write(pcm);
        }
    }

    private static void writeIntLE(FileOutputStream out, int value) throws IOException {
        out.write(value & 0xff);
        out.write((value >> 8) & 0xff);
        out.write((value >> 16) & 0xff);
        out.write((value >> 24) & 0xff);
    }

    private static void writeShortLE(FileOutputStream out, short value) throws IOException {
        out.write(value & 0xff);
        out.write((value >> 8) & 0xff);
    }
}
