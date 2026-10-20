# Stand-in for a browser input box: a focused text field that mirrors its content to a file.
import tkinter as tk

root = tk.Tk()
root.title("PasteTarget")
root.geometry("500x80+100+100")
entry = tk.Entry(root, font=("DejaVu Sans", 14))
entry.pack(fill="x", padx=10, pady=20)
entry.focus_set()

def dump():
    with open("/tmp/target.txt", "w") as f:
        f.write(entry.get())
    root.after(200, dump)

dump()
root.mainloop()
