import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  AlertDialogCloseButton,
} from '@chakra-ui/react';
import { MutableRefObject } from 'react';

export type SimpleAlertProps = {
  isOpen: boolean,
  onClose: () => void,
  cancelRef: MutableRefObject<null>,
  message: string
  title?: string
}

const SimpleAlert = ({ isOpen, onClose, cancelRef, message, title = 'Error' }: SimpleAlertProps) => {
  return (
    <AlertDialog
      motionPreset='slideInBottom'
      leastDestructiveRef={cancelRef}
      onClose={onClose}
      isOpen={isOpen}
      isCentered
    >
      <AlertDialogOverlay />
      <AlertDialogContent pb='10px'>
        <AlertDialogHeader>{title}</AlertDialogHeader>
        <AlertDialogCloseButton />
        <AlertDialogBody>
          {message}
        </AlertDialogBody>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default SimpleAlert
