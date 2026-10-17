#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>
#import <ApplicationServices/ApplicationServices.h>
#import <Carbon/Carbon.h>
#import <unistd.h>
#import <stdio.h>
#import <stdlib.h>
#import <string.h>

/**
 * Native macOS Paste Synthesizer & Active App Resolver
 *
 * Usage:
 *   paste-helper-mac --get-active-pid     Prints the frontmost application PID to stdout
 *   paste-helper-mac --check-ax           Prints 1 if accessibility trusted, 0 otherwise
 *   paste-helper-mac --request-ax         Requests accessibility permission with system prompt
 *   paste-helper-mac [pid]                Injects synthetic Cmd+V into the target application
 */

static void post_cmd_v(pid_t pid) {
    // 180ms settling delay to allow the target app to regain window and input focus
    usleep(180000);

    CGEventSourceRef src = CGEventSourceCreate(kCGEventSourceStateHIDSystemState);
    if (!src) {
        src = CGEventSourceCreate(kCGEventSourceStateCombinedSessionState);
    }
    if (!src) return;

    CGKeyCode cmdKey = (CGKeyCode)55; // Command key
    CGKeyCode vKey   = (CGKeyCode)9;  // 'v' key

    // 1. Command Down
    CGEventRef cmdDown = CGEventCreateKeyboardEvent(src, cmdKey, true);
    if (pid > 0) CGEventPostToPid(pid, cmdDown);
    else CGEventPost(kCGHIDEventTap, cmdDown);
    usleep(15000);

    // 2. 'V' Down with Command modifier flag
    CGEventRef vDown = CGEventCreateKeyboardEvent(src, vKey, true);
    CGEventSetFlags(vDown, kCGEventFlagMaskCommand);
    if (pid > 0) CGEventPostToPid(pid, vDown);
    else CGEventPost(kCGHIDEventTap, vDown);
    usleep(15000);

    // 3. 'V' Up with Command modifier flag
    CGEventRef vUp = CGEventCreateKeyboardEvent(src, vKey, false);
    CGEventSetFlags(vUp, kCGEventFlagMaskCommand);
    if (pid > 0) CGEventPostToPid(pid, vUp);
    else CGEventPost(kCGHIDEventTap, vUp);
    usleep(15000);

    // 4. Command Up
    CGEventRef cmdUp = CGEventCreateKeyboardEvent(src, cmdKey, false);
    if (pid > 0) CGEventPostToPid(pid, cmdUp);
    else CGEventPost(kCGHIDEventTap, cmdUp);

    CFRelease(cmdDown);
    CFRelease(vDown);
    CFRelease(vUp);
    CFRelease(cmdUp);
    CFRelease(src);
}

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        if (argc > 1) {
            if (strcmp(argv[1], "--get-active-pid") == 0) {
                NSRunningApplication *frontApp = [[NSWorkspace sharedWorkspace] frontmostApplication];
                if (frontApp) {
                    printf("%d\n", [frontApp processIdentifier]);
                } else {
                    printf("0\n");
                }
                return 0;
            }

            if (strcmp(argv[1], "--check-ax") == 0) {
                Boolean trusted = AXIsProcessTrusted();
                printf("%d\n", trusted ? 1 : 0);
                return 0;
            }

            if (strcmp(argv[1], "--request-ax") == 0) {
                NSDictionary *options = @{(__bridge id)kAXTrustedCheckOptionPrompt: @YES};
                Boolean trusted = AXIsProcessTrustedWithOptions((__bridge CFDictionaryRef)options);
                printf("%d\n", trusted ? 1 : 0);
                return 0;
            }
        }

        pid_t target_pid = 0;
        if (argc > 1) {
            long parsed = strtol(argv[1], NULL, 10);
            if (parsed > 0 && parsed <= 999999) {
                target_pid = (pid_t)parsed;
            }
        }

        NSRunningApplication *targetApp = nil;
        if (target_pid > 0) {
            targetApp = [NSRunningApplication runningApplicationWithProcessIdentifier:target_pid];
        }

        // Fallback to frontmost app if target is invalid or not found
        if (!targetApp) {
            targetApp = [[NSWorkspace sharedWorkspace] frontmostApplication];
            if (targetApp) {
                target_pid = [targetApp processIdentifier];
            }
        }

        if (targetApp) {
            // Only activate if NOT already the frontmost application.
            // Never use NSApplicationActivateIgnoringOtherApps when the app is already active,
            // because if the app has a full-screen window on another space (e.g. Chrome with 1 fullscreen tab
            // and 1 standard window), activateIgnoringOtherApps forces macOS Mission Control to switch spaces!
            if (![targetApp isActive]) {
                [targetApp activateWithOptions:0];
            }
        }

        post_cmd_v(target_pid);
    }
    return 0;
}
