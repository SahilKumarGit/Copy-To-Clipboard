#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>
#import <ApplicationServices/ApplicationServices.h>
#import <unistd.h>

/**
 * Native macOS Paste Synthesizer & Active App Resolver
 *
 * Usage:
 *   paste-helper-mac --get-active-pid     Prints the frontmost application PID to stdout
 *   paste-helper-mac [pid]                Injects synthetic Cmd+V into the specified PID
 */

static void post_cmd_v(pid_t target_pid) {
    // 180ms focus settling delay
    usleep(180000);

    CGEventSourceRef src = CGEventSourceCreate(kCGEventSourceStateHIDSystemState);
    if (!src) return;

    // 1. Command Down (keycode 55)
    CGEventRef cmdDown = CGEventCreateKeyboardEvent(src, (CGKeyCode)55, true);
    // 2. V Down (keycode 9) with Command flag
    CGEventRef vDown = CGEventCreateKeyboardEvent(src, (CGKeyCode)9, true);
    CGEventSetFlags(vDown, kCGEventFlagMaskCommand);
    // 3. V Up (keycode 9) with Command flag
    CGEventRef vUp = CGEventCreateKeyboardEvent(src, (CGKeyCode)9, false);
    CGEventSetFlags(vUp, kCGEventFlagMaskCommand);
    // 4. Command Up (keycode 55)
    CGEventRef cmdUp = CGEventCreateKeyboardEvent(src, (CGKeyCode)55, false);

    if (target_pid > 0) {
        CGEventPostToPid(target_pid, cmdDown);
        CGEventPostToPid(target_pid, vDown);
        CGEventPostToPid(target_pid, vUp);
        CGEventPostToPid(target_pid, cmdUp);
    } else {
        CGEventPost(kCGHIDEventTap, cmdDown);
        CGEventPost(kCGHIDEventTap, vDown);
        CGEventPost(kCGHIDEventTap, vUp);
        CGEventPost(kCGHIDEventTap, cmdUp);
    }

    CFRelease(cmdDown);
    CFRelease(vDown);
    CFRelease(vUp);
    CFRelease(cmdUp);
    CFRelease(src);
}

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        if (argc > 1 && strcmp(argv[1], "--get-active-pid") == 0) {
            NSRunningApplication *frontApp = [[NSWorkspace sharedWorkspace] frontmostApplication];
            if (frontApp) {
                printf("%d\n", [frontApp processIdentifier]);
            } else {
                printf("0\n");
            }
            return 0;
        }

        pid_t target_pid = 0;
        if (argc > 1) {
            long parsed = strtol(argv[1], NULL, 10);
            if (parsed > 0 && parsed <= 999999) {
                target_pid = (pid_t)parsed;
            }
        }

        if (target_pid > 0) {
            NSRunningApplication *app = [NSRunningApplication runningApplicationWithProcessIdentifier:target_pid];
            if (app) {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
                [app activateWithOptions:NSApplicationActivateIgnoringOtherApps];
#pragma clang diagnostic pop
            }
        }

        post_cmd_v(target_pid);
    }
    return 0;
}
