using System.Drawing;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace RyanMusic;

internal sealed class ClosePromptDialog : Form
{
    private const int DwmwaUseImmersiveDarkMode = 20;
    private const int DwmwaBorderColor = 34;
    private const int DwmwaCaptionColor = 35;

    private readonly CheckBox _remember;

    public CloseAction ChosenAction { get; private set; } = CloseAction.Ask;
    public bool RememberChoice => _remember.Checked;

    public ClosePromptDialog()
    {
        Text = "RyanMusic";
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        ShowInTaskbar = false;
        StartPosition = FormStartPosition.CenterParent;
        ClientSize = new Size(420, 196);
        BackColor = Color.FromArgb(18, 18, 26);
        ForeColor = Color.FromArgb(245, 245, 250);
        Font = new Font("Microsoft YaHei UI", 10.5f, FontStyle.Regular, GraphicsUnit.Point);

        var label = new Label
        {
            AutoSize = false,
            Text = "关闭窗口时，你希望：",
            Location = new Point(24, 22),
            Size = new Size(372, 28),
            ForeColor = Color.FromArgb(245, 245, 250)
        };

        _remember = new CheckBox
        {
            Text = "记住我的选择",
            Location = new Point(24, 58),
            AutoSize = true,
            ForeColor = Color.FromArgb(190, 190, 200),
            BackColor = Color.FromArgb(18, 18, 26),
            FlatStyle = FlatStyle.Flat
        };
        _remember.HandleCreated += (_, _) => DisableVisualStyles(_remember);

        var btnTray = MakeButton("缩小到托盘", new Point(24, 118), DialogResult.Yes);
        var btnExit = MakeButton("退出应用", new Point(156, 118), DialogResult.No);
        var btnCancel = MakeButton("取消", new Point(288, 118), DialogResult.Cancel, ghost: true);

        btnTray.Click += (_, _) => ChosenAction = CloseAction.Tray;
        btnExit.Click += (_, _) => ChosenAction = CloseAction.Exit;

        AcceptButton = btnTray;
        CancelButton = btnCancel;

        Controls.Add(label);
        Controls.Add(_remember);
        Controls.Add(btnTray);
        Controls.Add(btnExit);
        Controls.Add(btnCancel);

        HandleCreated += (_, _) => ApplyDarkTitleBar();
        Shown += (_, _) => ApplyDarkTitleBar();
    }

    private Button MakeButton(string text, Point location, DialogResult result, bool ghost = false)
    {
        var fill = ghost ? Color.FromArgb(28, 28, 38) : Color.FromArgb(48, 48, 64);
        var btn = new Button
        {
            Text = text,
            Location = location,
            Size = new Size(108, 36),
            FlatStyle = FlatStyle.Flat,
            UseVisualStyleBackColor = false,
            BackColor = fill,
            ForeColor = Color.FromArgb(245, 245, 250),
            DialogResult = result,
            Cursor = Cursors.Hand
        };
        btn.FlatAppearance.BorderSize = ghost ? 1 : 0;
        btn.FlatAppearance.BorderColor = Color.FromArgb(90, 90, 112);
        btn.FlatAppearance.MouseOverBackColor = Color.FromArgb(250, 45, 85);
        btn.FlatAppearance.MouseDownBackColor = Color.FromArgb(220, 36, 72);
        btn.HandleCreated += (_, _) => DisableVisualStyles(btn);
        return btn;
    }

    private void ApplyDarkTitleBar()
    {
        if (!IsHandleCreated)
        {
            return;
        }

        try
        {
            var hwnd = Handle;
            var dark = 1;
            _ = DwmSetWindowAttribute(hwnd, DwmwaUseImmersiveDarkMode, ref dark, sizeof(int));
            var caption = 0x1A1212;
            _ = DwmSetWindowAttribute(hwnd, DwmwaCaptionColor, ref caption, sizeof(int));
            var border = 0x1A1212;
            _ = DwmSetWindowAttribute(hwnd, DwmwaBorderColor, ref border, sizeof(int));
        }
        catch
        {
            // 旧系统忽略
        }
    }

    private static void DisableVisualStyles(Control control)
    {
        try
        {
            _ = SetWindowTheme(control.Handle, string.Empty, string.Empty);
        }
        catch
        {
            // 旧系统忽略
        }
    }

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

    [DllImport("uxtheme.dll", CharSet = CharSet.Unicode)]
    private static extern int SetWindowTheme(IntPtr hwnd, string pszSubAppName, string pszSubIdList);
}
