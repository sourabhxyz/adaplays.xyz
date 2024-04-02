// TODO
// - All the preview, preprod & testnet have same id of 0, so logic should be fine only when mainnet is desired.

import type { User } from "next-auth"
import type { SupportedWallets } from '../types/types'

import { useState, useRef, useEffect } from 'react';
import NextLink from 'next/link';
import { navHeight } from 'constants/global';
import { WalletApi, Lucid } from "lucid-cardano";
import {
  Heading,
  Flex,
  Text,
  Icon,
  Link,
  HStack,
  Popover,
  PopoverTrigger,
  Button,
  PopoverContent,
  PopoverArrow,
  PopoverCloseButton,
  PopoverHeader,
  PopoverBody,
  PopoverFooter,
  useDisclosure,
  VStack,
  FormControl,
  FormErrorMessage,
  Input
} from '@chakra-ui/react';
import { FaGithub } from 'react-icons/fa';
import { useSession, signIn, signOut } from 'next-auth/react';
import SimpleAlert from './simple-alert';
import { Field, Form, Formik } from 'formik';
import Logo from './logo';
import * as yup from "yup";
import YupPassword from 'yup-password'
YupPassword(yup)
import { brandButtonStyle } from 'theme/simple'
import { getApi, getLucid } from "utils/lucid/lucid";
import nufiCoreSdk, { SocialLoginInfo } from '@nufi/dapp-client-core'
import {initNufiDappCardanoSdk} from '@nufi/dapp-client-cardano'
import {SsoButton} from '@nufi/sso-button-react'
import styles from './navbar.module.css'

export default function Navbar() {
  const [logoHover, setLogoHover] = useState<boolean>(false);

  return (
    <Flex
      // position="sticky"
      // top="0"
      // zIndex='docked'
      bg="white"
      borderBottom={1}
      borderStyle='solid'
      borderColor='black'
      h={navHeight}
      align='center'
      justify='space-between'
    >
      {/* Logo */}
      <NextLink href="/" passHref>
        <Link
          onMouseEnter={() => setLogoHover(true)}
          onMouseLeave={() => setLogoHover(false)}
        >
          <HStack>
            <Heading variant='brand' position='relative' left='10px' bg='white' borderRightRadius='full'>
              adaplays
            </Heading>
            <Logo />
          </HStack>
          {/* <Logo logoHover={logoHover} /> */}
        </Link>
      </NextLink>
      <HStack mr='10px'>
        <Link isExternal aria-label='Go to adaplays Github page' href='https://www.github.com/adaplays'>
          <Icon
            as={FaGithub}
            display='block'
            transition='color 0.2s'
            color='black'
            w='7'
            h='7'
            mr='8px'
            _hover={{ color: 'gray.600' }}
          />
          {/* <IconButton aria-label='Github page' icon={<FaGithub />} colorScheme='teal' variant='link' /> */}
          {/* <Box 
            borderColor='white'  // to hide it
            borderBottomWidth='2px'
            cursor='pointer'
            _hover={{
              borderColor:'black', borderBottomWidth: '2px'
            }}
            >
            <Icon pt='10px' height='36px' width='36px' as={FaGithub}></Icon>
          </Box> */}
        </Link>
        <ConnectButton />
      </HStack>
    </Flex>
  );
}

const ConnectButton = () => {
  const { status, data } = useSession()

  const [ssoUserInfo, setSSOUserInfo] = useState<null | SocialLoginInfo>(null)

  // Note that this does not represent the currently connected wallet. Instead
  // it represents that wallet that user chooses during Connect wallet process.
  const [_candidateWalletName, _setCandidateWalletName] = useState<SupportedWallets>('nufi')

  // Note that this does not tell whether user is connected. This information is found in
  // "{data: {user: {wallet}}}" obtained from "useSession". This is only a state relevant
  // for the Connect wallet process.
  const [walletConnectFinished, setWalletConnectedFinished] = useState<boolean>(false)

  const [selectWalletTapped, setSelectWalletTapped] = useState<boolean>(false)
  const [isDisconnecting, setIsDisconnecting] = useState<boolean>(false)
  const [isConnecting, setIsConnecting] = useState<boolean>(false)

  // I have two alert setup, one fires up when selected wallet is not installed in the browser and other one when enabled wallet is on wrong network
  const walletNotFound = useDisclosure()
  const cancelRefWalletNotFound = useRef(null)
  const wrongNetwork = useDisclosure()
  const cancelRefWrongNetwork = useRef(null)

  useEffect(() => {
    nufiCoreSdk.init('https://wallet-testnet-staging.nu.fi')
      
    // Listen for SSO session info
    const currentSSOInfo = nufiCoreSdk.getApi().onSocialLoginInfoChanged((data) => {
      setSSOUserInfo(data)
    })
    setSSOUserInfo(currentSSOInfo)
  }, [])

  // Ensure that widget is shown on page refresh if authenticated
  useEffect(() => {
    const fn = async () => {
      if (status === 'authenticated') {
        if (data.user.wallet === 'nufiSSO') {
          initNufiDappCardanoSdk(nufiCoreSdk, 'sso')
          await window.cardano.nufiSSO.enable()
        }
        if (data.user.wallet === 'nufiSnap') {
          initNufiDappCardanoSdk(nufiCoreSdk, 'snap')
          await window.cardano.nufiSnap.enable()
        }
      }
    }
    fn()
  }, [status, data])

  const resetStatus = () => {
    // why setTimeout? Well because there is a slight delay in closing of Popover.
    setTimeout(() => {
      setWalletConnectedFinished(false);
      setSelectWalletTapped(false);
    }, 200)
  }
  const supportedWallets: SupportedWallets[] = ['nufi', 'nufiSnap']
  const getFallbackWalletName = (wallet: SupportedWallets) => {
    if (wallet === 'nufiSnap') return 'Cardano Wallet'
    return null
  }

  const createPasswordSchema = yup.object().shape({
    password: yup
      .string()
      .required('Please enter your password')
      .min(10, "Must be atleast 10 characters")  // following recommendation from: https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-132.pdf
      .max(32, "Must be atmost 32 characters")
      .minLowercase(1, "Must contain atleast 1 lowercase character")
      .minUppercase(1, "Must contain atleast 1 uppercase character")
      .minNumbers(1, "Must contain atleast 1 number")
      .minSymbols(1, "Must contain atleast 1 special case character"),
    confirmPassword: yup.string().oneOf([yup.ref('password'), null], "Passwords must match").required('Please confirm your password')
  })

  const connectbuttonStyle = brandButtonStyle

  const popoverHeaderStyle = {
    align: 'center',
    fontWeight: 'bold',
    borderColor: 'black'
  }

  const popoverFooterStyle = {
    borderColor: 'black',
    mt: '10px',
  }

  const hasWalletExtension = (walletName: SupportedWallets) => (!!window.cardano?.[walletName])

  const disconnecting = async () => {
    setIsDisconnecting(true);
    resetStatus();
    await signOut({ redirect: false });
    setIsDisconnecting(false);

    // As there is no such method in CIP-30 we need to close widget manually
    if (data?.user.wallet === 'nufiSSO' || data?.user.wallet === 'nufiSnap') {
      nufiCoreSdk.getApi().hideWidget()
    }
  }

  const connectWallet = async (walletName: SupportedWallets) => {
    if (!hasWalletExtension(walletName)) {
      walletNotFound.onOpen();
    } else {
      try {
        setIsConnecting(true)
        const api: WalletApi = await getApi(walletName)
        // In case the above connection fails, the whole component fails so I guess nothing to worry.
        const networkId = await api.getNetworkId();
        if (networkId !== 0) {
          wrongNetwork.onOpen()
        } else {
          _setCandidateWalletName(walletName)
          setWalletConnectedFinished(await window.cardano[walletName].isEnabled())
        }
      } catch (e) {
        console.error(e);
        resetStatus();
      } finally {
        setIsConnecting(false)
      }
    }
  }

  if (status === 'loading') return (
    <Button isLoading {...connectbuttonStyle}>
      Connect
    </Button>
  ); else if (status === 'unauthenticated') return (
    <>
      <SimpleAlert {...{ isOpen: walletNotFound.isOpen, onClose: () => { resetStatus(); walletNotFound.onClose() }, cancelRef: cancelRefWalletNotFound, message: "You don't have the selected wallet installed." }} />
      <SimpleAlert {...{ isOpen: wrongNetwork.isOpen, onClose: () => { resetStatus(); wrongNetwork.onClose() }, cancelRef: cancelRefWrongNetwork, message: "You have selected wrong network, please switch to Preprod." }} />
      
      <Popover onClose={resetStatus}>
        <PopoverTrigger>
          {/* Wrapped in extra button as the current Popover logic of this
          dapp is designed to work this way. Should not be needed in other dapps. */}
          <Button {...connectbuttonStyle} border="none" margin={0} padding={0}>
            <SsoButton
              state="logged_out"
              label="Login"
              isLoading={isConnecting}
              onLogin={() => {
                _setCandidateWalletName('nufiSSO')
                initNufiDappCardanoSdk(nufiCoreSdk, 'sso');
                connectWallet('nufiSSO')
              }}
              classes={{
                base: styles.ssoButton
              }}
            />
          </Button>
        </PopoverTrigger>
        <PopoverTrigger>
          <Button {...connectbuttonStyle}>
            Connect Wallet
          </Button>
        </PopoverTrigger>
        {walletConnectFinished === false
          ? _candidateWalletName !== 'nufiSSO' ? 
          (<PopoverContent>
            <PopoverHeader {...popoverHeaderStyle}>
              Select wallet
            </PopoverHeader>
            <PopoverArrow />
            <PopoverCloseButton />
            <PopoverBody>
              <VStack>
                {supportedWallets.map((walletName) => (
                  <Button key={walletName} onClick={() => {
                    setSelectWalletTapped(true);
                    if (walletName === 'nufiSnap') {
                      initNufiDappCardanoSdk(nufiCoreSdk, 'snap');
                    }
                    connectWallet(walletName)
                  }} variant='link' colorScheme='black' isLoading={selectWalletTapped}>
                    {window.cardano?.[walletName]?.name || getFallbackWalletName(walletName) || walletName}
                  </Button>
                ))}
              </VStack>
              <PopoverFooter {...popoverFooterStyle}>
                <Text align='center'> ✤ step 1 of 2 ✤ </Text>
              </PopoverFooter>
            </PopoverBody>
          </PopoverContent>) : null
          : <PopoverContent>
            <PopoverHeader {...popoverHeaderStyle}>
              Create session password
            </PopoverHeader>
            <PopoverArrow />
            <PopoverCloseButton />
            <PopoverBody>
              {"🛈 Some games require the generation of secret numbers. For the convenience of user, instead of writing down all your secret numbers, they'll be effectively encrypted with the help of your password. Also, in case such a game couldn't be completed, say due to power outage, your password will be later used to recover it."}
              <br />
              {"⚠ We don't store your password. If you specify a different password for this session then you won't be able to recover any previous unfinished games that require the use of password."}
              <Formik
                initialValues={{ password: '', confirmPassword: '' }}
                validationSchema={createPasswordSchema}
                onSubmit={async (values, actions) => {
                  const lucid: Lucid = await getLucid(_candidateWalletName)
                  const walletAddress = await lucid.wallet.address()
                  const cred: User = { id: walletAddress, password: values.password, wallet: _candidateWalletName }
                  // spread is used because: https://bobbyhadz.com/blog/typescript-index-signature-for-type-is-missing-in-type
                  await signIn('credentials', { ...cred, redirect: false })
                  actions.resetForm()
                }}
              >
                {(props) => (
                  <Form>
                    <FormControl isInvalid={!!props.errors.password && props.touched.password} mt='7px' borderColor='black'>
                      {/* <FormLabel>Enter password</FormLabel> */}
                      <Field as={Input} name='password' type='password' placeholder='Enter password' />
                      <FormErrorMessage>{props.errors.password}</FormErrorMessage>
                    </FormControl>
                    <FormControl isInvalid={!!props.errors.confirmPassword && props.touched.confirmPassword} mt='7px' borderColor='black'>
                      {/* <FormLabel>Confirm password</FormLabel> */}
                      <Field as={Input} name='confirmPassword' type='password' placeholder='Confirm password' />
                      <FormErrorMessage>{props.errors.confirmPassword}</FormErrorMessage>
                    </FormControl>
                    <Flex justify='center'>
                      <Button
                        mt={4}
                        {...connectbuttonStyle}
                        isLoading={props.isSubmitting}
                        type='submit'
                      >
                        Submit
                      </Button>
                    </Flex>
                  </Form>
                )}
              </Formik>
              <PopoverFooter {...popoverFooterStyle}>
                <Text align='center'> ✤ step 2 of 2 ✤ </Text>
              </PopoverFooter>
            </PopoverBody>
          </PopoverContent>
        }
      </Popover>
    </>
  ); else return (
    <>
      {data?.user.wallet === 'nufiSSO' ? (
        <SsoButton
          state="logged_in"
          label={ssoUserInfo?.email || 'Connected'}
          userInfo={{
            provider: ssoUserInfo?.typeOfLogin
          }}
          isLoading={isDisconnecting}
          onLogout={() => disconnecting()}
          classes={{
            base: styles.ssoButton
          }}
        />
      ) : (
      <Button {...connectbuttonStyle} onClick={() => disconnecting()} isLoading={isDisconnecting} >
        Disconnect
      </Button>
      )}
    </>
  );
}
