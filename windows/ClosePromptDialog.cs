using System.Drawing;
using System.Windows.Forms;

namespace RyanMusic;

internal sealed class ClosePromptDialog : Form
{
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
            BackColor = Color.Transparent
        };

        var btnTray = MakeButton("缩小到托盘", new Point(24, 118), DialogResult.Yes);
        var btnExit = MakeButton("退出应用", new Point(156, 118), DialogResult.No);
        var btnCancel = MakeButton("取消", new Point(288, 118), DialogResult.Cancel);

        btnTray.Click += (_, _) => ChosenAction = CloseAction.Tray;
        btnExit.Click += (_, _) => ChosenAction = CloseAction.Exit;

        AcceptButton = btnTray;
        CancelButton = btnCancel;

        Controls.Add(label);
        Controls.Add(_remember);
        Controls.Add(btnTray);
        Controls.Add(btnExit);
        Controls.Add(btnCancel);
    }

    private Button MakeButton(string text, Point location, DialogResult result)
    {
        var btn = new Button
        {
            Text = text,
            Location = location,
            Size = new Size(108, 36),
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(42, 42, 56),
            ForeColor = Color.White,
            DialogResult = result,
            Cursor = Cursors.Hand
        };
        btn.FlatAppearance.BorderColor = Color.FromArgb(70, 70, 90);
        btn.FlatAppearance.MouseOverBackColor = Color.FromArgb(250, 45, 85);
        return btn;
    }
}
