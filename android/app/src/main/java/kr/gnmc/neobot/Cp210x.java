package kr.gnmc.neobot;

import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;

import java.io.IOException;

/**
 * 네오봇 동글(Silicon Labs CP210x) 최소 드라이버.
 * 라이브러리 없이 USB 제어 전송으로 UART를 켜고 속도·형식을 맞춘 뒤 벌크 전송으로 주고받음.
 * (CP210x 명령: AN571 — IFC_ENABLE 0x00, SET_LINE_CTL 0x03, SET_MHS 0x07, SET_BAUDRATE 0x1E)
 */
class Cp210x {
    static final int VID = 0x10C4;
    private static final int REQTYPE_HOST_TO_DEVICE = 0x41;
    private static final int IFC_ENABLE = 0x00, SET_LINE_CTL = 0x03, SET_MHS = 0x07, SET_BAUDRATE = 0x1E;
    private static final int UART_ENABLE = 0x0001, UART_DISABLE = 0x0000;
    private static final int TIMEOUT = 1000;

    private final UsbDevice device;
    private UsbDeviceConnection conn;
    private UsbInterface intf;
    private UsbEndpoint epIn, epOut;

    Cp210x(UsbDevice device) { this.device = device; }

    static boolean isCp210x(UsbDevice d) { return d != null && d.getVendorId() == VID; }

    void open(UsbManager mgr, int baud) throws IOException {
        conn = mgr.openDevice(device);
        if (conn == null) throw new IOException("openDevice 실패(권한 없음?)");
        intf = device.getInterface(0);
        if (!conn.claimInterface(intf, true)) throw new IOException("claimInterface 실패");
        for (int i = 0; i < intf.getEndpointCount(); i++) {
            UsbEndpoint ep = intf.getEndpoint(i);
            if (ep.getType() != UsbConstants.USB_ENDPOINT_XFER_BULK) continue;
            if (ep.getDirection() == UsbConstants.USB_DIR_IN) epIn = ep; else epOut = ep;
        }
        if (epIn == null || epOut == null) throw new IOException("벌크 엔드포인트 없음");
        ctrl(IFC_ENABLE, UART_ENABLE, null);
        ctrl(SET_LINE_CTL, 0x0800, null);              // 8 데이터비트, 패리티 없음, 정지비트 1
        byte[] b = { (byte) baud, (byte) (baud >> 8), (byte) (baud >> 16), (byte) (baud >> 24) };
        ctrl(SET_BAUDRATE, 0, b);
    }

    /** DTR·RTS 설정 (Web Serial setSignals와 같은 뜻) */
    void setSignals(boolean dtr, boolean rts) throws IOException {
        int v = 0x0300 | (dtr ? 0x01 : 0) | (rts ? 0x02 : 0);   // 상위 바이트 = 바꿀 비트 마스크
        ctrl(SET_MHS, v, null);
    }

    int read(byte[] buf, int timeoutMs) {
        if (conn == null) return -1;
        return conn.bulkTransfer(epIn, buf, buf.length, timeoutMs);
    }

    void write(byte[] data) throws IOException {
        if (conn == null) throw new IOException("닫힘");
        int n = conn.bulkTransfer(epOut, data, data.length, TIMEOUT);
        if (n < 0) throw new IOException("bulkTransfer 실패");
    }

    void close() {
        if (conn == null) return;
        try { ctrl(IFC_ENABLE, UART_DISABLE, null); } catch (IOException ignored) { }
        try { conn.releaseInterface(intf); } catch (Exception ignored) { }
        conn.close();
        conn = null;
    }

    private void ctrl(int req, int value, byte[] data) throws IOException {
        int n = conn.controlTransfer(REQTYPE_HOST_TO_DEVICE, req, value, intf.getId(), data, data == null ? 0 : data.length, TIMEOUT);
        if (n < 0) throw new IOException("controlTransfer " + req + " 실패");
    }
}
