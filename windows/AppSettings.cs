using System.Text.Json;

namespace RyanMusic;

internal enum CloseAction
{
    Ask,
    Tray,
    Exit
}

internal static class AppSettings
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private sealed class Data
    {
        public string CloseAction { get; set; } = "ask";
    }

    private static string SettingsPath =>
        Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "RyanMusic",
            "settings.json");

    public static CloseAction GetCloseAction()
    {
        try
        {
            var path = SettingsPath;
            if (!File.Exists(path))
            {
                return CloseAction.Ask;
            }

            var raw = File.ReadAllText(path);
            var data = JsonSerializer.Deserialize<Data>(raw, JsonOptions);
            return ParseCloseAction(data?.CloseAction);
        }
        catch
        {
            return CloseAction.Ask;
        }
    }

    public static void SetCloseAction(CloseAction action)
    {
        try
        {
            var dir = Path.GetDirectoryName(SettingsPath);
            if (!string.IsNullOrEmpty(dir))
            {
                Directory.CreateDirectory(dir);
            }

            var data = new Data { CloseAction = ToWire(action) };
            File.WriteAllText(SettingsPath, JsonSerializer.Serialize(data, JsonOptions));
        }
        catch
        {
            // ignore
        }
    }

    private static string ToWire(CloseAction action) => action switch
    {
        CloseAction.Tray => "tray",
        CloseAction.Exit => "exit",
        _ => "ask"
    };

    private static CloseAction ParseCloseAction(string? value) =>
        (value ?? "").Trim().ToLowerInvariant() switch
        {
            "tray" => CloseAction.Tray,
            "exit" => CloseAction.Exit,
            _ => CloseAction.Ask
        };
}
