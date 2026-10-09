import { fireEvent, render } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';
import { EmergencyButton } from '../src/ui/components';

describe('deliberate emergency dialer action', () => {
  test('requires a button press and a separate confirmation before opening the dialer', async () => {
    const showConfirmation = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const openDialer = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const screen = await render(<EmergencyButton />);
    expect(showConfirmation).not.toHaveBeenCalled();
    expect(openDialer).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Emergency? Call 911' }));
    expect(showConfirmation).toHaveBeenCalledWith('Call 911?', expect.any(String), expect.any(Array));
    expect(openDialer).not.toHaveBeenCalled();

    const actions = showConfirmation.mock.calls[0][2];
    expect(actions?.find((action) => action.text === 'Cancel')?.style).toBe('cancel');
    actions?.find((action) => action.text === 'Open dialer')?.onPress?.();
    expect(openDialer).toHaveBeenCalledWith('tel:911');
  });
});
