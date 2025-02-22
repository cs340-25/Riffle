import { StyleSheet, View, Image, Pressable } from 'react-native';
import { Link } from 'expo-router';

export default function HomeButton() {
    return (
        <View style={styles.container}>
            <Link href="/homeButtonScreen">
                <Pressable>
                    <Image
                        source={require("../assets/images/homeButton.png")}
                        style={styles.image}
                    />
                </Pressable>
            </Link>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: 150,
        height: 150,
    },
    image: {
        width: 150,
        height: 150,
    }
});