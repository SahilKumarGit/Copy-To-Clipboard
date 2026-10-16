#include <ApplicationServices/ApplicationServices.h>
#include <unistd.h>

int main() {
    usleep(100000); // 100ms
    CGEventSourceRef src = CGEventSourceCreate(kCGEventSourceStateHIDSystemState);
    CGEventRef keyDown = CGEventCreateKeyboardEvent(src, (CGKeyCode)9, true);
    CGEventSetFlags(keyDown, kCGEventFlagMaskCommand);
    CGEventPost(kCGHIDEventTap, keyDown);
    
    CGEventRef keyUp = CGEventCreateKeyboardEvent(src, (CGKeyCode)9, false);
    CGEventSetFlags(keyUp, kCGEventFlagMaskCommand);
    CGEventPost(kCGHIDEventTap, keyUp);
    
    CFRelease(keyDown);
    CFRelease(keyUp);
    CFRelease(src);
    return 0;
}
