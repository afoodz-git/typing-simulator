using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Runtime.InteropServices;

namespace HackerTyperSender {
    class Program {
        [DllImport("user32.dll", SetLastError = true)]
        static extern uint SendInput(uint nInputs, [In] INPUT[] pInputs, int cbSize);

        const int INPUT_KEYBOARD = 1;
        const uint KEYEVENTF_UNICODE = 0x0004;
        const uint KEYEVENTF_KEYUP = 0x0002;

        const ushort VK_RETURN = 0x0D;
        const ushort VK_ESCAPE = 0x1B;
        const ushort VK_SHIFT = 0x10;
        const ushort VK_HOME = 0x24;
        const ushort VK_BACK = 0x08;
        const ushort VK_DELETE = 0x2E;
        const ushort VK_TAB = 0x09;

        [StructLayout(LayoutKind.Sequential)]
        struct INPUT {
            public uint type;
            public InputUnion u;
        }

        [StructLayout(LayoutKind.Explicit)]
        struct InputUnion {
            [FieldOffset(0)]
            public MOUSEINPUT mi;
            [FieldOffset(0)]
            public KEYBDINPUT ki;
            [FieldOffset(0)]
            public HARDWAREINPUT hi;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct KEYBDINPUT {
            public ushort wVk;
            public ushort wScan;
            public uint dwFlags;
            public uint time;
            public IntPtr dwExtraInfo;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct MOUSEINPUT {
            public int dx;
            public int dy;
            public uint mouseData;
            public uint dwFlags;
            public uint time;
            public IntPtr dwExtraInfo;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct HARDWAREINPUT {
            public uint uMsg;
            public ushort wParamL;
            public ushort wParamH;
        }

        static void SendChar(char c) {
            INPUT[] inputs = new INPUT[2];

            inputs[0] = new INPUT();
            inputs[0].type = INPUT_KEYBOARD;
            inputs[0].u.ki.wVk = 0;
            inputs[0].u.ki.wScan = (ushort)c;
            inputs[0].u.ki.dwFlags = KEYEVENTF_UNICODE;

            inputs[1] = new INPUT();
            inputs[1].type = INPUT_KEYBOARD;
            inputs[1].u.ki.wVk = 0;
            inputs[1].u.ki.wScan = (ushort)c;
            inputs[1].u.ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;

            SendInput(2, inputs, Marshal.SizeOf(typeof(INPUT)));
        }

        static void SendKey(ushort vk) {
            INPUT[] inputs = new INPUT[2];
            inputs[0] = new INPUT();
            inputs[0].type = INPUT_KEYBOARD;
            inputs[0].u.ki.wVk = vk;

            inputs[1] = new INPUT();
            inputs[1].type = INPUT_KEYBOARD;
            inputs[1].u.ki.wVk = vk;
            inputs[1].u.ki.dwFlags = KEYEVENTF_KEYUP;

            SendInput(2, inputs, Marshal.SizeOf(typeof(INPUT)));
        }

        static void SendKeyCombo(ushort modVk, ushort keyVk) {
            INPUT[] inputs = new INPUT[4];
            inputs[0] = new INPUT();
            inputs[0].type = INPUT_KEYBOARD;
            inputs[0].u.ki.wVk = modVk;

            inputs[1] = new INPUT();
            inputs[1].type = INPUT_KEYBOARD;
            inputs[1].u.ki.wVk = keyVk;

            inputs[2] = new INPUT();
            inputs[2].type = INPUT_KEYBOARD;
            inputs[2].u.ki.wVk = keyVk;
            inputs[2].u.ki.dwFlags = KEYEVENTF_KEYUP;

            inputs[3] = new INPUT();
            inputs[3].type = INPUT_KEYBOARD;
            inputs[3].u.ki.wVk = modVk;
            inputs[3].u.ki.dwFlags = KEYEVENTF_KEYUP;

            SendInput(4, inputs, Marshal.SizeOf(typeof(INPUT)));
        }

        static void SendEnter() {
            // Dismiss any open IntelliSense / AutoComplete / Copilot popup so Enter strictly creates a new line
            SendKey(VK_ESCAPE);
            Thread.Sleep(10);

            SendKey(VK_RETURN);
            Thread.Sleep(15);

            // Safely reset any editor auto-indent back to column 0.
            // Shift+Tab only outdents whitespace and never deletes lines or moves cursor up.
            for (int k = 0; k < 12; k++) {
                SendKeyCombo(VK_SHIFT, VK_TAB);
                Thread.Sleep(2);
            }
            Thread.Sleep(10);
        }

        static void SendString(string text) {
            for (int i = 0; i < text.Length; i++) {
                char c = text[i];
                if (c == '\r') continue;
                if (c == '\n') {
                    SendEnter();
                } else {
                    SendChar(c);
                    if (c == '{' || c == '(' || c == '[') {
                        bool isEndOfLine = true;
                        for (int j = i + 1; j < text.Length; j++) {
                            if (text[j] == '\r' || text[j] == '\n') break;
                            if (!char.IsWhiteSpace(text[j])) {
                                isEndOfLine = false;
                                break;
                            }
                        }
                        if (isEndOfLine) {
                            Thread.Sleep(5);
                            SendKey(VK_DELETE);
                        }
                    }
                }
                Thread.Sleep(2);
            }
        }

        static void Main(string[] args) {
            Console.OutputEncoding = Encoding.UTF8;
            Console.InputEncoding = Encoding.UTF8;

            string line;
            while ((line = Console.ReadLine()) != null) {
                if (line.StartsWith("TYPE:")) {
                    string payload = line.Substring(5);
                    byte[] data = Convert.FromBase64String(payload);
                    string decoded = Encoding.UTF8.GetString(data);
                    SendString(decoded);
                    Console.WriteLine("OK");
                } else if (line == "PING") {
                    Console.WriteLine("PONG");
                } else if (line == "EXIT") {
                    break;
                }
            }
        }
    }
}
